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
};

export interface VoteCreation {
  pollJwt: string;
  customResponse?: string;
  response_idx?: number;
}
export const voteCreationValidationRules = {
  pollJwt: 'required',
  customResponse: 'required_without:response_idx|min:8|max:250',
  response_idx: 'required_without:customResponse|integer',
};
