"""
haimtran 30 JUL 2022
"""


def main(event, context):
    """
    submit job
    """
    return {
        "id": event["id"],
        "status": "SUCCEEDED",
        "lambdaResult": {
            "message": "Hello Hai Tran "
        }
    }
