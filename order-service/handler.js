'use strict';

const { randomUUID } = require("crypto");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const { SQSClient, SendMessageCommand } = require("@aws-sdk/client-sqs");

const dynamoDbClient = new DynamoDBClient({});
const ddbClient = DynamoDBDocumentClient.from(dynamoDbClient);
const sqsClient = new SQSClient({});

module.exports.createOrder = async (event) => {
  try {
    const body = JSON.parse(event.body);
    const order = {
      orderId: randomUUID(),
      customerName: body.customerName,
      totalAmount: body.totalAmount,
      status: 'PENDING',
      createdAt: new Date().toISOString()
    }

    await ddbClient.send(
      new PutCommand({
        TableName: process.env.ORDERS_TABLE,
        Item: order,
      })
    );

    await sqsClient.send(
      new SendMessageCommand({
        QueueUrl: process.env.ORDER_QUEUE_URL,
        MessageBody: JSON.stringify(order)
      })
    );

    return {
      statusCode: 201,
      body: JSON.stringify(order),
    }
  } catch (error) {
    console.error('Error creating order:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to create order' }),
    }
  }
};
