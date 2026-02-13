'use strict';

const { randomUUID } = require("crypto");
const { DynamoDBClient, ConditionalCheckFailedException } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand, UpdateCommand, QueryCommand } = require("@aws-sdk/lib-dynamodb");
const { SQSClient, SendMessageCommand } = require("@aws-sdk/client-sqs");
const { OrderStatus } = require("./constants");
const dynamoDbClient = new DynamoDBClient({});
const ddbClient = DynamoDBDocumentClient.from(dynamoDbClient);
const sqsClient = new SQSClient({});

module.exports.createOrder = async (event) => {
  try {
    const body = JSON.parse(event.body);
    const idempotencyKey = event.headers['Idempotency-Key'];

    if (!idempotencyKey) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Idempotency-Key header is required' }),
      }
    }

    console.log(`Checking for existing order with idempotency key: ${idempotencyKey}`);

    const existingOrder = await ddbClient.send(
      new QueryCommand({
        TableName: process.env.ORDERS_TABLE,
        IndexName: 'IdempotencyIndex',
        KeyConditionExpression: "idempotencyKey = :key",
        ExpressionAttributeValues: {
          ":key": idempotencyKey
        }
      })
    )

    if (existingOrder?.Items?.length > 0) {
      console.log(`Order ${existingOrder.Items[0].orderId} already exists: ${idempotencyKey}`);

      return {
        statusCode: 200,
        body: JSON.stringify(existingOrder.Items[0]),
      }
    }

    const orderId = randomUUID();
    const order = {
      orderId: orderId,
      idempotencyKey: idempotencyKey,
      customerName: body.customerName,
      totalAmount: body.totalAmount,
      status: OrderStatus.PENDING,
      createdAt: new Date().toISOString()
    }

    console.log(`Creating new order: ${orderId}`);

    await ddbClient.send(
      new PutCommand({
        TableName: process.env.ORDERS_TABLE,
        Item: order,
        ConditionExpression: "attribute_not_exists(orderId)"
      })
    );

    console.log(`Sending order to SQS: ${orderId}`);

    await sqsClient.send(
      new SendMessageCommand({
        QueueUrl: process.env.ORDER_QUEUE_URL,
        MessageBody: JSON.stringify({ orderId })
      })
    );

    console.log(`Order ${orderId} created successfully`);

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

    try {

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
    } catch (error) {
      if (error instanceof ConditionalCheckFailedException) {
        console.log(`Order ${orderId} has already been processed`);
      } else {
        console.error(`Error processing payment for order ${orderId}:`, error);
      }
    }
  }
}