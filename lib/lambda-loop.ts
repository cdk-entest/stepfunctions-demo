import {
  aws_lambda,
  aws_stepfunctions,
  aws_stepfunctions_tasks,
  Stack,
  StackProps,
} from "aws-cdk-lib";
import { Construct } from "constructs";
import * as path from "path";
import * as fs from "fs";

export class LambdaLoopStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

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

    const iterLambda = new aws_lambda.Function(this, "IterLambda", {
      runtime: aws_lambda.Runtime.PYTHON_3_8,
      code: aws_lambda.Code.fromInline(
        fs.readFileSync(path.resolve(__dirname, "./../lambda/iter-lambda.py"), {
          encoding: "utf-8",
        })
      ),
      handler: "index.main",
    });

    const getNumIter = new aws_stepfunctions_tasks.LambdaInvoke(
      this,
      "GetNumIter",
      {
        lambdaFunction: getNumIterLambda,
        outputPath: "$.Payload",
      }
    );

    const nextIter = new aws_stepfunctions_tasks.LambdaInvoke(
      this,
      "LambdaProcessJob",
      {
        lambdaFunction: iterLambda,
        outputPath: "$.Payload",
      }
    );

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
  }
}
