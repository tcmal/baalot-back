import { Request, Response } from 'express';
import { Client } from 'cassandra-driver';
import Validator from 'validatorjs';
import { v4 as uuid } from 'uuid';
import { verify } from 'jsonwebtoken';

import { getJWTSecret } from './config';
import { validatorErrorsToJson, sendJson, okJson } from './utils';
import { getClient } from './db';
import { PollJWT, VoteCreation, voteCreationValidationRules } from './models';

export const addVote = async (req: Request, res: Response) => {
  // Validate input
  const validator = new Validator(req.body, voteCreationValidationRules);

  if (validator.fails()) {
    return validatorErrorsToJson(res, validator);
  }

  const body = req.body as VoteCreation;
  const customResponse = 'customResponse' in body;

  // Get poll info
  let payload = {}
  try {
    payload = await verify(body.pollJwt, await getJWTSecret()) as object;
  } catch (_) {}
  
  if (!payload || !('uuid' in payload)) {
    // Probably a user JWT or something else we signed
    return sendJson(res, 400, { msg: 'Invalid JWT' });
  }

  const poll = payload as PollJWT;
  // Check they don't want to respond in a disallowed way
  if (
    customResponse !== poll.freeResponse ||
    (customResponse && 'responseIdx' in body) ||
    (!customResponse &&
      (body.responseIdx || 99999) >= (poll.responses || []).length)
  ) {
    return sendJson(res, 400, {
      msg: 'Free response not allowed or invalid vote',
    });
  }

  // Add to database
  const client = await getClient();
  if (customResponse) {
    await client.execute(
      'INSERT INTO vote (uuid, poll_uuid, custom_response) VALUES (uuid(), ?, ?)',
      [poll.uuid, body.customResponse || ''],
      { prepare: true }
    );
  } else {
    await client.execute(
      'INSERT INTO vote (uuid, poll_uuid, response_idx) VALUES (uuid(), ?, ?)',
      [poll.uuid, body.responseIdx || 0],
      { prepare: true }
    );
  }

  // OK!
  return okJson(res, { success: true });
};
