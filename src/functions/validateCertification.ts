import { APIGatewayProxyHandler } from 'aws-lambda';
import { document } from '../utils/dynamoDbClient';

interface ICertificateData {
  id: string;
  name: string;
  created_at: string;
  grade: string;
}

export const handler: APIGatewayProxyHandler = async (event) => {
  const { id } = event.pathParameters;

  const response = await document
    .query({
      TableName: 'users_certificate',
      KeyConditionExpression: 'id = :id',
      ExpressionAttributeValues: { ':id': id },
    })
    .promise();

  const certificate = response.Items[0] as ICertificateData;

  if (certificate) {
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'The certificate is valid.',
        id: certificate.id,
        name: certificate.name,
        certified_at: certificate.created_at,
        grade: certificate.grade,
      }),
    };
  } else {
    return {
      statusCode: 400,
      body: JSON.stringify({
        message: 'Certificate not valid!',
        id,
      }),
    };
  }
};
