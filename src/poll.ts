import { Request, Response } from 'express';
import { Client } from 'cassandra-driver';
import Validator from 'validatorjs';
import { v4 as uuid } from 'uuid';
import { sign, verify } from 'jsonwebtoken';
import { once } from 'events';

import { getJWTSecret, bucket, STORAGE_BUCKET_NAME } from './config';
import { validatorErrorsToJson, okJson } from './utils';
import { getClient } from './db';
import {
  PollCreation,
  PollMeta,
  PollResponse,
  pollCreationValidationRules,
  PollEndJWT,
  PollJWT,
} from './models';

export const createPoll = async (req: Request, res: Response) => {
  // Validate input
  const validator = new Validator(req.body, pollCreationValidationRules);

  if (validator.fails()) {
    return validatorErrorsToJson(res, validator);
  }

  const body = req.body as PollCreation;

  // Create poll meta object
  const meta: PollMeta = {
    uuid: uuid(),
    question: body.question,
    freeResponse: body.freeResponse,
  };

  // If it's not a free response poll, we need to store the possible responses
  let responses: PollResponse[] = [];
  if (!body.freeResponse) {
    responses = (body.responses || []).map((v: string, i: number) => ({
      uuid: meta.uuid,
      idx: i,
      response: v,
    }));
  }

  // Insert everything into the database
  const insertMeta = {
    query:
      'INSERT INTO poll_meta (uuid, question, free_response) VALUES (?, ?, ?)',
    params: [meta.uuid, meta.question, meta.freeResponse],
  };
  const insertResponses = responses.map((x: PollResponse) => ({
    query: 'INSERT INTO poll_responses (uuid, idx, response) VALUES (?, ?, ?)',
    params: [x.uuid, x.idx, x.response],
  }));

  const client = await getClient();
  await client.batch([insertMeta, ...insertResponses], { prepare: true });

  // Generate the JWT
  const payload: PollJWT = {
    uuid: meta.uuid,
    question: meta.question,
    freeResponse: body.freeResponse,
  };
  if (!body.freeResponse) {
    payload.responses = body.responses || [];
  }

  const jwt = await sign(payload, await getJWTSecret());

  // Generate the JWT for ending it
  const endPayload: PollEndJWT = {
    uuid: meta.uuid,
    started: new Date(),
  };

  const endJwt = await sign(endPayload, await getJWTSecret());

  return okJson(res, {
    jwt,
    payload,
    endJwt,
  });
};

export const getResults = async (req: Request, res: Response) => {
  // Validate input
  const validator = new Validator(req.body, {
    endJwt: 'required',
  });

  if (validator.fails()) {
    return validatorErrorsToJson(res, validator);
  }

  const body = req.body as { endJwt: string };

  // Make sure they're allowed to close the poll
  let payload: any = {};
  try {
    payload = (await verify(
      req.body.endJwt,
      await getJWTSecret()
    )) as {uuid?: string, started?: string};
  } catch (_) {}
  
  if (
    payload == null ||
    !('uuid' in payload && 'started' in payload) ||
    new Date(payload.started || "") >= new Date()
  ) {
    validator.errors.add('endJwt', 'Invalid');
    return validatorErrorsToJson(res, validator);
  }

  let ending: PollEndJWT = {
    uuid: payload.uuid,
    started: new Date(payload.started || ""),
  } as PollEndJWT;

  // Get the poll meta object
  const client = await getClient();
  const q = await client.execute(
    'SELECT uuid, ended, question, free_response FROM poll_meta WHERE uuid = ?',
    [ending.uuid],
    { prepare: true }
  );

  if (q.rows.length !== 1 || q.rows[0].ended != null) {
    validator.errors.add('uuid', 'No poll with that UUID');
    return validatorErrorsToJson(res, validator);
  }
  q.rows[0].freeResponse = q.rows[0].free_response;
  const meta = (q.rows[0] as unknown) as PollMeta;
  const poll: PollJWT = {
    uuid: ending.uuid,
    question: meta.question,
    freeResponse: meta.freeResponse,
  };

  // Update the poll meta object
  await client.execute(
    'UPDATE poll_meta SET ended = toTimestamp(now()) WHERE uuid = ?',
    [ending.uuid],
    { prepare: true }
  );

  // If it's not free response, get the responses
  if (!poll.freeResponse) {
    // We can't initially use an array, since they might come in from the database out of order
    const responsesObj: string[] = [];

    // eachRow isn't properly async ready
    await new Promise((resolve, reject) => {
      client.eachRow(
        'SELECT idx, response FROM poll_responses WHERE uuid = ?',
        [poll.uuid],
        { prepare: true },
        (_: number, x: object) => {
          const resp = x as { idx: number; response: string };
          responsesObj[resp.idx] = resp.response;
        },
        (err, results) => {
          if (err) {
            reject(err);
          } else if (results.nextPage) {
            results.nextPage();
          } else {
            resolve();
          }
        }
      );
    });

    poll.responses = responsesObj;
  }

  if (!poll.freeResponse) {
    let count = 0;
    const counts: any = {};

    // eachRow isn't properly async ready
    await new Promise((resolve, reject) => {
      client.eachRow(
        'SELECT response_idx FROM vote WHERE poll_uuid = ?',
        [poll.uuid],
        { prepare: true },
        (_: number, x: any) => {
          const voteFor = (x as {response_idx: number}).response_idx;

          counts[voteFor] = (counts[voteFor] || 0) + 1;
          count++;
        },
        (err, results) => {
          if (err) {
            reject(err);
          } else if (results.nextPage) {
            results.nextPage();
          } else {
            resolve();
          }
        }
      );
    });

    // Get the results
    return okJson(res, {
      poll,
      count,
      counts,
    });
  } else {
    let file = bucket.file(ending.uuid + ".txt");
    let stream = file.createWriteStream();
    let count = 0;

    await new Promise((resolve, reject) => {
      client.eachRow(
        'SELECT custom_response FROM vote WHERE poll_uuid = ?',
        [poll.uuid],
        { prepare: true },
        (_: number, x: object) => {
          let resp = (x as any).custom_response;
          stream.write(resp + "\n");
          count++;
        },
        (err, results) => {
          if (err) {
            reject(err);
          } else if (results.nextPage) {
            results.nextPage();
          } else {
            resolve();
          }
        }
      )
    });

    stream.end();
    await once(stream, 'finish');
    return okJson(res, {
      poll,
      count,
      url: "https://storage.googleapis.com/" + STORAGE_BUCKET_NAME + "/" + ending.uuid + ".txt"
    })
  }

};
