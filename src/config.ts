import { promises as fs } from 'fs';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import { logger } from './logging';

export const GCP_PROJECT_NAME = process.env.GCP_PROJECT || '';

const secretClient = new SecretManagerServiceClient();

// TODO: Cache things in here

// Everything needed to connect to astra database
export interface AstraSecrets {
  bundlePath: string;
  username: string;
  password: string;
}

// Helper function
const getSecretName = (name: string) =>
  'projects/' + GCP_PROJECT_NAME + '/secrets/' + name + '/versions/latest';

// Get all the astra-related secrets
export async function getAstraSecrets(): Promise<AstraSecrets> {
  const [bundleResp] = await secretClient.accessSecretVersion({
    name: getSecretName('astra_secure_connect'),
  });

  const data = (bundleResp.payload as { data: string }).data;

  // Write the connection bundle to a file
  await fs.writeFile('/tmp/secretBundle.zip', data);

  const [jsonResp] = await secretClient.accessSecretVersion({
    name: getSecretName('astra_credentials'),
  });

  const json = (jsonResp.payload as { data: string | object }).data.toString();
  const creds = JSON.parse(json) as { username: string; password: string };

  return {
    bundlePath: '/tmp/secretBundle.zip',
    ...creds,
  };
}

// Get the JWT secret
export async function getJWTSecret() {
  const [resp] = await secretClient.accessSecretVersion({
    name: getSecretName('jwt_secret'),
  });

  return (resp.payload as { data: string | object }).data.toString();
}
