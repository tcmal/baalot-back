import { promises as fs } from 'fs';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import { Storage } from '@google-cloud/storage';
import { logger } from './logging';

export const GCP_PROJECT_NAME = process.env.GCP_PROJECT || '';
export const STORAGE_BUCKET_NAME = process.env.STORAGE_BUCKET_NAME || '';

export const bucket = () => new Storage().bucket(STORAGE_BUCKET_NAME);

let secretBundlePath: string | undefined;
let cachedSecrets: any = {};
let cachedSecretClient: SecretManagerServiceClient | undefined;
const getSecretClient = () => {
  if (!cachedSecretClient) {
    cachedSecretClient = new SecretManagerServiceClient();
  }
  return cachedSecretClient as SecretManagerServiceClient;
}

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
  let secretClient = getSecretClient();

  if (!secretBundlePath) {
    const [bundleResp] = await secretClient.accessSecretVersion({
      name: getSecretName('astra_secure_connect'),
    });

    const data = (bundleResp.payload as { data: string }).data;

    // Write the connection bundle to a file
    await fs.writeFile('./secretBundle.zip', data);

    secretBundlePath = "./secretBundle.zip";
  }

  if (!cachedSecrets['astra_credentials']) {
    const [jsonResp] = await secretClient.accessSecretVersion({
      name: getSecretName('astra_credentials'),
    });

    const json = (jsonResp.payload as { data: string | object }).data.toString();
    cachedSecrets['astra_credentials'] = JSON.parse(json);
  }

  const creds = cachedSecrets['astra_credentials'] as { username: string; password: string };

  return {
    bundlePath: secretBundlePath,
    ...creds,
  };
}

// Get the JWT secret
export async function getJWTSecret() {
  let secretClient = getSecretClient();
  const [resp] = await secretClient.accessSecretVersion({
    name: getSecretName('jwt_secret'),
  });

  return (resp.payload as { data: string | object }).data.toString();
}
