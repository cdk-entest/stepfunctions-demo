"""
lambda counter
"""
import time


def main(event, context):
    """
    decrease counter
    """
    # current counter
    counter = event["counter"]
    # process logic here
    time.sleep(1)
    # decrease counter
    counter = counter - 1
    # return
    return {"counter": counter}
