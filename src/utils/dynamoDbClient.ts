import { DynamoDB } from 'aws-sdk';

const options = {
  region: 'localhost',
  endpoint: 'http://localhost:8000',
  accessKeyId: 'x',
  secretAccessKey: 'x',
};

const isOffline = () => {
  return process.env.IS_OFFLINE; //auto managed by serverless-offline lib, no need for .env file
};

export const document = isOffline()
  ? new DynamoDB.DocumentClient(options)
  : new DynamoDB.DocumentClient();
