// haimtran 30 JUL 2022
// transfer data record

import {
  aws_dynamodb,
  aws_lambda,
  aws_stepfunctions,
  aws_stepfunctions_tasks,
  Duration,
  Stack,
  StackProps,
} from "aws-cdk-lib";
import { Construct } from "constructs";
import * as path from "path";
import * as fs from "fs";

export class TrasnferDataRecordStack extends Stack {
  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);

    // ** -------------------- dynamodb table -----------------------*/
    const table = new aws_dynamodb.Table(this, "TableStepFuncDemo", {
      tableName: "TableStepFuncDemo",
      partitionKey: {
        name: "MessageId",
        type: aws_dynamodb.AttributeType.STRING,
      },
    });

    // ** -------------------- lambda seed table ----------------------*/
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

    // ** -------------------- stepfunction  -----------------------*/
    const seedTask = new aws_stepfunctions_tasks.LambdaInvoke(
      this,
      "SeedDDBTable",
      {
        lambdaFunction: func,
        outputPath: "$.Payload",
      }
    );

    const readNextItem = new aws_stepfunctions_tasks.DynamoGetItem(
      this,
      "GetItemFromDb",
      {
        table: table,
        key: {
          MessageId:
            aws_stepfunctions_tasks.DynamoAttributeValue.fromString(
              "MessageNo1"
            ),
        },
        resultPath: "$.DynamoDB",
      }
    );

    const popItemFromList = new aws_stepfunctions.Pass(
      this,
      "PopItemFromList",
      {
        parameters: {
          "List.$": "$.List[1:]",
        },
      }
    );

    const conditionLoop = new aws_stepfunctions.Choice(
      this,
      "ConditionLoop",
      {}
    );

    const definition = seedTask.next(
      conditionLoop
        .when(
          aws_stepfunctions.Condition.stringEquals("$.List[0]", "DONE"),
          new aws_stepfunctions.Succeed(this, "Finish")
        )
        .otherwise(readNextItem.next(popItemFromList.next(conditionLoop)))
    );

    const stateMachine = new aws_stepfunctions.StateMachine(
      this,
      "TransferRecordStateMachine",
      {
        stateMachineName: "TransferRecord",
        definition: definition,
      }
    );
  }
}
