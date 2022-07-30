"""
haimtran 30 JUL 2022
"""


def main(event, context):
    """
    check status
    """
    return {
        "status": "SUCCEEDED",
        "output": event
    }
