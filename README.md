### Serverless Order Service

![NodeJS](https://img.shields.io/badge/node.js-6DA55F?style=for-the-badge&logo=node.js&logoColor=white)
![AWS](https://img.shields.io/badge/AWS-%23FF9900.svg?style=for-the-badge&logo=amazon-aws&logoColor=white)
![DynamoDB](https://img.shields.io/badge/DynamoDB-4053D6?style=for-the-badge&logo=amazon-dynamodb&logoColor=white)
![SQS](https://img.shields.io/badge/SQS-FF9900?style=for-the-badge&logo=amazon-sqs&logoColor=white)
![Serverless](https://img.shields.io/badge/serverless-FD5750?style=for-the-badge&logo=serverless&logoColor=white)
![Zod](https://img.shields.io/badge/Zod-374151?style=for-the-badge&logo=zod&logoColor=white)

This project is a scalable, event-driven order management microservice deployed on AWS. It decouples order ingestion from processing using Amazon SQS and ensures data integrity with DynamoDB.

#### Key Features:

- Event-Driven Architecture: Uses SQS to buffer orders (createOrder) for asynchronous processing (processPayment).
- Idempotency: Prevents duplicate processing using DynamoDB Global Secondary Indexes.
- Fault Tolerance: Includes Dead Letter Queues (DLQ) for handling failed messages.
- Infrastructure as Code: Fully defined using 
serverless.yml

## Acknowledgments

- [Serverless Framework](https://www.serverless.com/)
- [AWS](https://aws.amazon.com/)
- [Node.js](https://nodejs.org/)
- [DynamoDB](https://aws.amazon.com/dynamodb/)
- [SQS](https://aws.amazon.com/sqs/)
- [Zod](https://zod.dev/)
