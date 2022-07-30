"""
haimtran 30 JUL 2022
seed a ddb table
"""

import os
import json
import boto3


client = boto3.client('dynamodb')


def handler(event, context):
    """
    seed a table with data
    """
    message_ids = []
    for i in range(10):
        message_id = f'MessageNo{i}'
        message_ids.append(message_id)
        resp = client.put_item(
            TableName=os.environ["TABLE_NAME"],
            Item={
                "MessageId": {
                    "S": message_id
                },
                "Message": {
                    "S": f"Hello This is message {i}"
                }
            }
        )
        print(resp)
    message_ids.append("DONE")
    return {
        "List": message_ids
    }


handler(event={}, context={})
