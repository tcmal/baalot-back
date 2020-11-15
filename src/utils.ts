import { Validator } from 'validatorjs';
import { Request, Response } from 'express';
import { verify } from 'jsonwebtoken';
import { getJWTSecret } from './config';

export function validatorErrorsToJson(
  res: Response,
  validator: Validator<object>
) {
  // TODO
  const obj = {
    errors: validator.errors,
  };

  sendJson(res, 400, obj);
}

export function sendJson(res: Response, code: number, obj: object) {
  res
    .status(code)
    .type('application/json')
    .send(JSON.stringify(obj))
    .end();
}

export function okJson(res: Response, obj: object) {
  return sendJson(res, 200, obj);
}
