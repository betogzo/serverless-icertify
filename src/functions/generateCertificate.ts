import { APIGatewayProxyHandler } from 'aws-lambda';
import { document } from '../utils/dynamoDbClient';
import { compile } from 'handlebars';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import dayjs from 'dayjs';
import chromium from 'chrome-aws-lambda';
import { S3 } from 'aws-sdk';

interface ICreateCertificate {
  id: string;
  name: string;
  grade: string;
}

interface ITemplate {
  id: string;
  name: string;
  grade: string;
  medal: string;
  date: string;
}

const compileTemplate = async (data: ITemplate) => {
  const certificatePath = join(
    process.cwd(),
    'src',
    'templates',
    'certificate.hbs'
  );

  const html = readFileSync(certificatePath, 'utf-8');

  return compile(html)(data);
};

export const handler: APIGatewayProxyHandler = async (event) => {
  const { id, name, grade } = JSON.parse(event.body) as ICreateCertificate;

  //checking for duplicate documents, since dynamodb has no unique constraint :(
  const response = await document
    .query({
      TableName: 'users_certificate',
      KeyConditionExpression: 'id = :id',
      ExpressionAttributeValues: { ':id': id },
    })
    .promise();

  if (!response.Items[0]) {
    //document.put doesnt return false/success, manual checking is needed
    //important: dynamodb's query always return an array!
    //writing to dynamodb
    await document
      .put({
        TableName: 'users_certificate',
        Item: {
          id,
          name,
          grade,
          created_at: new Date().toISOString(),
        },
      })
      .promise();
  }

  const medalPath = join(process.cwd(), 'src', 'templates', 'medal.png');
  const medal = readFileSync(medalPath, 'base64');

  const data: ITemplate = {
    name,
    id,
    grade,
    date: dayjs().format('DD/MM/YYYY'),
    medal,
  };

  const content = await compileTemplate(data);

  const browser = await chromium.puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath,
    userDataDir: './temp',
  });

  const page = await browser.newPage();

  await page.setContent(content);

  let pdf: Buffer;

  try {
    //generating the certificate PDF
    pdf = await page.pdf({
      format: 'a4',
      landscape: true,
      printBackground: true,
      preferCSSPageSize: true,
      path: process.env.IS_OFFLINE ? `./${id}-certificado.pdf` : null,
    });

    //persisting the certificate on amazon s3 storage
    const s3 = new S3();

    await s3
      .putObject({
        Bucket: 'svlessicertify',
        Key: `${id}.pdf`,
        ACL: 'public-read',
        Body: pdf,
        ContentType: 'application/pdf',
      })
      .promise();

    return {
      statusCode: 201,
      body: JSON.stringify({
        message: 'Certificate successfully generated.',
        url: `https://svlessicertify.s3.amazonaws.com/${id}.pdf`,
      }),
    };
  } catch (error) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        message: 'Something went wrong.',
        error,
      }),
    };
  } finally {
    await browser.close();
  }
};
