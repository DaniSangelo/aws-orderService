'use strict';

const { randomUUID } = require("crypto");
const { DynamoDBClient, ConditionalCheckFailedException } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand, UpdateCommand, QueryCommand } = require("@aws-sdk/lib-dynamodb");
const { SQSClient, SendMessageCommand } = require("@aws-sdk/client-sqs");
const { OrderStatus } = require("./constants");
const dynamoDbClient = new DynamoDBClient({});
const ddbClient = DynamoDBDocumentClient.from(dynamoDbClient);
const sqsClient = new SQSClient({});
const { z } = require('zod')

const orderSchema = z.object({
  customerName: z.string().min(1, 'Customer name cannot be empty'),
  totalAmount: z.number().positive('Total amount must be positive'),
})

module.exports.createOrder = async (event) => {
  try {
    const body = JSON.parse(event.body);
    const idempotencyKey = event.headers['Idempotency-Key'] || event.headers['idempotency-key'] || event.headers['IDEMPOTENCY-KEY'];
    const validation = orderSchema.safeParse(body);

    if (!validation.success) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: validation.error.issues }),
      }
    }

    if (!idempotencyKey) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Idempotency-Key header is required' }),
      }
    }

    console.log(`Checking for existing order with idempotency key: ${idempotencyKey}`);

    const existingOrder = await getExistingOrder(idempotencyKey);
    if (existingOrder.Items && existingOrder.Items.length > 0) {
      console.log(`Order ${existingOrder.Items[0].orderId} already exists: ${idempotencyKey}`);
      return {
        statusCode: 200,
        body: JSON.stringify(existingOrder.Items[0]),
      }
    }

    const order = await createOrder(validation, idempotencyKey)
    console.log(`Sending order to SQS: ${order.orderId}`);

    await sqsClient.send(
      new SendMessageCommand({
        QueueUrl: process.env.ORDER_QUEUE_URL,
        MessageBody: JSON.stringify({ orderId: order.orderId })
      })
    );

    console.log(`Order ${order.orderId} created successfully`);

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

async function getExistingOrder(idempotencyKey) {
  /* 
    An elegant way to check for existing order would be to use idempotencyKey as the primary key,
    and the orderId as a secondary index. This would allow us to check for existing orders
    in O(1) time complexity.
  */
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
  return existingOrder;
}

async function createOrder(validation, idempotencyKey) {
  const { customerName, totalAmount } = validation.data;
  const orderId = randomUUID();
  const order = {
    orderId: orderId,
    idempotencyKey: idempotencyKey,
    customerName: customerName,
    totalAmount: totalAmount,
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

  return order;
}

module.exports.processPayment = async (event) => {
  for (const record of event.Records) {
    const { orderId } = JSON.parse(record.body);
    console.log(`Processing payment for: ${ orderId }`)
    const paymentApproved = shouldApprovePayment();
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

function shouldApprovePayment() {
  if (process.env.PAYMENT_APPROVAL_MODE == 'ALWAYS') return true;
  if (process.env.PAYMENT_APPROVAL_MODE == 'NEVER') return false;
  return Math.random() > 0.3;
}