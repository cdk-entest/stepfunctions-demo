## Pooler Job State Machine

<img width="603" alt="Screen Shot 2022-07-31 at 15 30 38" src="https://user-images.githubusercontent.com/20411077/182017641-0dc80683-6c69-4dad-aa6e-28f7d3396a74.png">

## Transfer Data Record State Machine

<img width="603" alt="Screen Shot 2022-07-31 at 15 30 04" src="https://user-images.githubusercontent.com/20411077/182017643-e00c6a45-849d-405f-b158-1ce08f62cb6f.png">

create a table

```tsx
const table = new aws_dynamodb.Table(this, "TableStepFuncDemo", {
  tableName: "TableStepFuncDemo",
  partitionKey: {
    name: "MessageId",
    type: aws_dynamodb.AttributeType.STRING,
  },
});
```

create a lambda function

```tsx
const func = new aws_lambda.Function(this, "SeedDDBFunction", {
  functionName: "SeedDDBFunction",
  code: aws_lambda.Code.fromInline(
    fs.readFileSync(path.join(__dirname, "./../lambda/seed_ddb.py"), {
      encoding: "utf-8",
    })
  ),
  handler: "index.handler",
  runtime: aws_lambda.Runtime.PYTHON_3_8,
  environment: {
    TABLE_NAME: table.tableName,
  },
});
table.grantWriteData(func);
```

create a task to seed/generate data into the data

```tsx
const seedTask = new aws_stepfunctions_tasks.LambdaInvoke(
  this,
  "SeedDDBTable",
  {
    lambdaFunction: func,
    outputPath: "$.Payload",
  }
);
```

create a task to retrieve an item from the table

```tsx
const readNextItem = new aws_stepfunctions_tasks.DynamoGetItem(
  this,
  "GetItemFromDb",
  {
    table: table,
    key: {
      MessageId:
        aws_stepfunctions_tasks.DynamoAttributeValue.fromString("MessageNo1"),
    },
    resultPath: "$.DynamoDB",
  }
);
```

create a task to pop the item from the retrieved list

```tsx
const popItemFromList = new aws_stepfunctions.Pass(this, "PopItemFromList", {
  parameters: {
    "List.$": "$.List[1:]",
  },
});
```

the condition loop

```tsx
const conditionLoop = new aws_stepfunctions.Choice(this, "ConditionLoop", {});
```

chain tasks into a state machine

```tsx
const definition = seedTask.next(
  conditionLoop
    .when(
      aws_stepfunctions.Condition.stringEquals("$.List[0]", "DONE"),
      new aws_stepfunctions.Succeed(this, "Finish")
    )
    .otherwise(readNextItem.next(popItemFromList).next(conditionLoop))
);

const stateMachine = new aws_stepfunctions.StateMachine(
  this,
  "TransferRecordStateMachine",
  {
    stateMachineName: "TransferRecord",
    definition: definition,
  }
);
```

## Reference

1. [Invoke lambda arn save payload](https://docs.aws.amazon.com/step-functions/latest/dg/connect-lambda.html)
2. [Stepfunctions job poller](https://github.com/aws-samples/aws-cdk-examples/tree/master/typescript/stepfunctions-job-poller)
3. [Stepfunctions workshop](https://catalog.workshops.aws/stepfunctions/en-US/module-9/step-4)
4. [Low-code speech ML and stepfunctions](https://aws.amazon.com/blogs/compute/building-a-low-code-speech-you-know-counter-using-aws-step-functions/)
5. [Sagemaker data wrangler into MLOps workflows](https://github.com/aws-samples/sm-data-wrangler-mlops-workflows)
