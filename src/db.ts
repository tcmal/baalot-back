import { Client } from 'cassandra-driver';
import { getAstraSecrets } from './config';

const keySpace = process.env.ASTRA_KEYSPACE || 'devhacks';

let currClient: Client | undefined;

async function connect() {
  const { username, password, bundlePath } = await getAstraSecrets();

  currClient = await new Client({
    cloud: { secureConnectBundle: bundlePath },
    credentials: { username, password },
  });

  await currClient.connect();
  await currClient.execute('USE ' + keySpace);
}

export async function getClient(): Promise<Client> {
  if (!currClient) {
    await connect();
  }

  return currClient as Client;
}
