export interface PollJWT {
  uuid: string;
  question: string;
  freeResponse: boolean;
  responses?: string[];
}

export interface PollEndJWT {
  uuid: string;
  started: Date;
}

export interface PollMeta {
  uuid: string;
  ended?: Date;
  question: string;
  freeResponse: boolean;
}

export interface PollResponse {
  uuid: string;
  idx: number;
  response: string;
}

export interface PollCreation {
  question: string;
  freeResponse: boolean;
  responses?: string[]; // present if !freeResponse
}

export const pollCreationValidationRules = {
  question: 'required|min:8|max:500',
  freeResponse: 'required|boolean',
  responses: 'required_if:freeResponse,false|array',
  'responses.*': 'string|required|max:250',
};

export interface VoteCreation {
  pollJwt: string;
  customResponse?: string;
  responseIdx?: number;
}
export const voteCreationValidationRules = {
  pollJwt: 'required',
  customResponse: 'required_without:responseIdx|max:250',
  responseIdx: 'required_without:customResponse|integer',
};
