'use strict';

const { randomUUID } = require("crypto");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const { SQSClient, SendMessageCommand } = require("@aws-sdk/client-sqs");
const { OrderStatus } = require("./constants");
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
      status: OrderStatus.PENDING,
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

module.exports.processPayment = async (event) => {
  for (const record of event.Records) {
    const { orderId } = JSON.parse(record.body);
    console.log(`Processing payment for: ${ orderId }`)
    const paymentApproved = Math.random() > 0.3;
    const newStatus = paymentApproved ? OrderStatus.APPROVED : OrderStatus.REJECTED;

    await ddbClient.send(
      new UpdateCommand({
        TableName: process.env.ORDERS_TABLE,
        Key: { orderId },
        UpdateExpression: "SET #status = :status, paymentProcessedAt = :now", // # is used along with status because status is a reserved keyword in DynamoDB
        ExpressionAttributeNames: {
          "#status": "status"
        },
        ConditionExpression: "#status = :expectedStatus",
        ExpressionAttributeValues: {
          ":status": newStatus,
          ":now": new Date().toISOString(),
          ":expectedStatus": OrderStatus.PENDING
        }
      })
    )

    console.log(`Order ${orderId} status updated to ${newStatus}`);
  }
}