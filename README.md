## Getting Started with Stepfunctions

Stepfunctions can be used for

- Data processing workflows
- Machine Learning pipelines
- Impelement backend with branches (if/else)

Stepfunctions can be created by

- Using CDK
- JSON definition

In this [GitHub](https://github.com/entest-hai/stepfunctions-demo), I implement some stepfunctions described from [aws docs](https://docs.aws.amazon.com/step-functions/latest/dg/sample-project-transfer-data-sqs.html)

## Iterate a Lambda Function

![Screen Shot 2022-08-11 at 13 24 56](https://user-images.githubusercontent.com/20411077/184076317-fa7415ea-7c5e-4dc9-a157-46130e537a09.png)

get number of iteration

```tsx
const getNumIterLambda = new aws_lambda.Function(this, "GetNumIterLambda", {
  code: aws_lambda.Code.fromInline(
    fs.readFileSync(
      path.resolve(__dirname, "./../lambda/get-num-iter-lambda.py"),
      { encoding: "utf-8" }
    )
  ),
  handler: "index.main",
  runtime: aws_lambda.Runtime.PYTHON_3_8,
});
```

processing an iteration

```tsx
const iterLambda = new aws_lambda.Function(this, "IterLambda", {
  runtime: aws_lambda.Runtime.PYTHON_3_8,
  code: aws_lambda.Code.fromInline(
    fs.readFileSync(path.resolve(__dirname, "./../lambda/iter-lambda.py"), {
      encoding: "utf-8",
    })
  ),
  handler: "index.main",
});
```

get number of iteration task

```tsx
const getNumIter = new aws_stepfunctions_tasks.LambdaInvoke(
  this,
  "GetNumIter",
  {
    lambdaFunction: getNumIterLambda,
    outputPath: "$.Payload",
  }
);
```

process an iter task

```tsx
const nextIter = new aws_stepfunctions_tasks.LambdaInvoke(
  this,
  "LambdaProcessJob",
  {
    lambdaFunction: iterLambda,
    outputPath: "$.Payload",
  }
);
```

state machine definition

```tsx
const definition = getNumIter.next(
  new aws_stepfunctions.Choice(this, "Loop Completed?")
    .when(
      aws_stepfunctions.Condition.numberEquals("$.counter", 0),
      new aws_stepfunctions.Succeed(this, "Finish")
    )
    .when(
      aws_stepfunctions.Condition.numberGreaterThan("$.counter", 0),
      nextIter
    )
);

new aws_stepfunctions.StateMachine(this, "LambdaIterMachine", {
  stateMachineName: "LambdaIter",
  definition: definition,
});
```

## Pooler Job State Machine

<img width="603" alt="Screen Shot 2022-07-31 at 15 30 38" src="https://user-images.githubusercontent.com/20411077/182017641-0dc80683-6c69-4dad-aa6e-28f7d3396a74.png">

create the submit lambda

```tsx
const submit = new aws_lambda.Function(this, "SubmitLambda", {
  functionName: "SubmitFunction",
  code: new aws_lambda.InlineCode(
    fs.readFileSync(path.resolve(__dirname, "./../lambda/submit.py"), {
      encoding: "utf-8",
    })
  ),
  handler: "index.main",
  timeout: Duration.seconds(10),
  runtime: aws_lambda.Runtime.PYTHON_3_8,
});
```

create the check status lambda

```tsx
// get status lambda function
const checkStatus = new aws_lambda.Function(this, "CheckStatusFunction", {
  functionName: "CheckStatusFunction",
  code: new aws_lambda.InlineCode(
    fs.readFileSync(path.resolve(__dirname, "./../lambda/check_status.py"), {
      encoding: "utf-8",
    })
  ),
  handler: "index.main",
  runtime: aws_lambda.Runtime.PYTHON_3_8,
  timeout: Duration.seconds(10),
});
```

create a submit task

```tsx
const submitTask = new aws_stepfunctions_tasks.LambdaInvoke(this, "SubmitJob", {
  lambdaFunction: submit,
  outputPath: "$",
});
```

create a wait

```tsx
const waitX = new aws_stepfunctions.Wait(this, "WaitXSeconds", {
  time: aws_stepfunctions.WaitTime.duration(Duration.seconds(10)),
});
```

create a check status

```tsx
const checkStatusTask = new aws_stepfunctions_tasks.LambdaInvoke(
  this,
  "CheckStatusTask",
  {
    lambdaFunction: checkStatus,
    outputPath: "$.Payload",
  }
);
```

create the job failed

```tsx
const jobFailed = new aws_stepfunctions.Fail(this, "JobFailed", {
  cause: "AWS Batch Job Failed",
  error: "Described returned FAILED",
});
```

create the final status

```tsx
const finalStatus = new aws_stepfunctions_tasks.LambdaInvoke(
  this,
  "GetFinalJobStatus",
  {
    lambdaFunction: checkStatus,
    outputPath: "$.Payload",
  }
);
```

chain tasks into a state machine

```tsx
// create chain
const definition = submitTask
  .next(waitX)
  .next(checkStatusTask)
  .next(
    new aws_stepfunctions.Choice(this, "Job Complete?")
      .when(
        aws_stepfunctions.Condition.stringEquals("$.status", "FAILED"),
        jobFailed
      )
      .when(
        aws_stepfunctions.Condition.stringEquals("$.status", "SUCCEEDED"),
        finalStatus
      )
      .otherwise(jobFailed)
  );

// state machine
const stateMachine = new aws_stepfunctions.StateMachine(
  this,
  "StateMachineDemo",
  {
    timeout: Duration.minutes(2),
    definition: definition,
  }
);
```

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
