#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { StepfunctionsDemoStack } from "../lib/stepfunctions-demo-stack";
import { TrasnferDataRecordStack } from "../lib/transfer-data-record-stack";
import { LambdaLoopStack } from "../lib/lambda-loop";

const app = new cdk.App();

// step function pool job
new StepfunctionsDemoStack(app, "StepfunctionsDemoStack", {});

// step function transfer data record
new TrasnferDataRecordStack(app, "TransferDataRecordStrack", {});

// step function lambda iteration
new LambdaLoopStack(app, "LambdaLoop", {});
