// haimtran 30 JUL 2022
// stepfunctions job poller
import {
  aws_lambda,
  aws_stepfunctions,
  aws_stepfunctions_tasks,
  Duration,
  Stack,
  StackProps,
} from "aws-cdk-lib";
import { Construct } from "constructs";
import * as fs from "fs";
import * as path from "path";

export class StepfunctionsDemoStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    //** ----------------- Lambda Handlers Definition ---------------------- */
    // submit lambda function
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

    // get status lambda function
    const checkStatus = new aws_lambda.Function(this, "CheckStatusFunction", {
      functionName: "CheckStatusFunction",
      code: new aws_lambda.InlineCode(
        fs.readFileSync(
          path.resolve(__dirname, "./../lambda/check_status.py"),
          {
            encoding: "utf-8",
          }
        )
      ),
      handler: "index.main",
      runtime: aws_lambda.Runtime.PYTHON_3_8,
      timeout: Duration.seconds(10),
    });

    //** ----------------- Step functions Definition ---------------------- */
    const submitTask = new aws_stepfunctions_tasks.LambdaInvoke(
      this,
      "SubmitJob",
      {
        lambdaFunction: submit,
        outputPath: "$",
      }
    );

    const waitX = new aws_stepfunctions.Wait(this, "WaitXSeconds", {
      time: aws_stepfunctions.WaitTime.duration(Duration.seconds(10)),
    });

    const checkStatusTask = new aws_stepfunctions_tasks.LambdaInvoke(
      this,
      "CheckStatusTask",
      {
        lambdaFunction: checkStatus,
        outputPath: "$.Payload",
      }
    );

    const jobFailed = new aws_stepfunctions.Fail(this, "JobFailed", {
      cause: "AWS Batch Job Failed",
      error: "Described returned FAILED",
    });

    const finalStatus = new aws_stepfunctions_tasks.LambdaInvoke(
      this,
      "GetFinalJobStatus",
      {
        lambdaFunction: checkStatus,
        outputPath: "$.Payload",
      }
    );

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
  }
}
