### Serverless Order Service

![NodeJS](https://img.shields.io/badge/node.js-6DA55F?style=for-the-badge&logo=node.js&logoColor=white)
![AWS](https://img.shields.io/badge/AWS-%23FF9900.svg?style=for-the-badge&logo=amazon-aws&logoColor=white)
![DynamoDB](https://img.shields.io/badge/DynamoDB-4053D6?style=for-the-badge&logo=amazon-dynamodb&logoColor=white)
![SQS](https://img.shields.io/badge/SQS-FF9900?style=for-the-badge&logo=amazon-sqs&logoColor=white)
![Serverless](https://img.shields.io/badge/serverless-FD5750?style=for-the-badge&logo=serverless&logoColor=white)
![Zod](https://img.shields.io/badge/Zod-374151?style=for-the-badge&logo=zod&logoColor=white)
![LocalStack](https://img.shields.io/badge/LocalStack-000000?style=for-the-badge&logo=localstack&logoColor=white)

This project is a scalable, event-driven order management microservice deployed on AWS. It decouples order ingestion from processing using Amazon SQS and ensures data integrity with DynamoDB.

#### Key Features:

- Event-Driven Architecture: Uses SQS to buffer orders (createOrder) for asynchronous processing (processPayment).
- Idempotency: Prevents duplicate processing using DynamoDB Global Secondary Indexes.
- Fault Tolerance: Includes Dead Letter Queues (DLQ) for handling failed messages.
- Infrastructure as Code: Fully defined using [serverless.yml](file:///c:/Users/Lenovo/Documents/Estudos/TI/nodeJS/serverless-service/order-service/serverless.yml).
- Local Development: Built-in support for [LocalStack](https://localstack.cloud/) for local testing and debugging.

## Local Development

To test the application locally without incurring AWS costs, use LocalStack.

### Prerequisites

1.  **LocalStack**: Ensure LocalStack is running (e.g., via Docker).

```yaml
services:
  localstack:
    container_name: "${LOCALSTACK_DOCKER_NAME:-localstack-main}"
    image: localstack/localstack
    ports:
      - "127.0.0.1:4566:4566"            # LocalStack Gateway
      - "127.0.0.1:4510-4559:4510-4559"  # external services port range
    environment:
      - DEBUG=1
      - SERVICES=cloudformation,iam,lambda,logs,apigateway,sqs,dynamodb
      - AWS_DEFAULT_REGION=us-east-1
    volumes:
      - "${LOCALSTACK_VOLUME_DIR:-./volume}:/var/lib/localstack"
      - "/var/run/docker.sock:/var/run/docker.sock"
```

2.  **Serverless LocalStack Plugin**: This project uses `serverless-localstack`.
    ```bash
    npm install --save-dev serverless-localstack
    ```
    Or
    ```bash
    cd order-service
    npm install
    ```

### Deployment

Deploy to the `local` stage to use the LocalStack endpoint:

```bash
serverless deploy --stage local
```

### Useful Commands

You can interact with your local resources using the AWS CLI with the `--endpoint-url` flag.

#### Scan DynamoDB Tables

```bash
aws --endpoint-url=http://localhost:4566 dynamodb scan --table-name OrdersTable
```

#### List SQS Queues

```bash
aws --endpoint-url=http://localhost:4566 sqs list-queues
```

## Acknowledgments

- [Serverless Framework](https://www.serverless.com/)
- [AWS](https://aws.amazon.com/)
- [Node.js](https://nodejs.org/)
- [DynamoDB](https://aws.amazon.com/dynamodb/)
- [SQS](https://aws.amazon.com/sqs/)
- [Zod](https://zod.dev/)
