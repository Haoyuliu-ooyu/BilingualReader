import json
import time

import boto3
import redis
import structlog
from redis.backoff import ExponentialBackoff
from redis.exceptions import ConnectionError, TimeoutError
from redis.retry import Retry

log = structlog.get_logger("worker.queue")


class RedisQueueService:
    """Queue backend using Redis (RPUSH/BLPOP) — used for local development."""

    def __init__(self, redis_url):
        retry = Retry(ExponentialBackoff(cap=60, base=1), retries=25)
        self.client = redis.from_url(
            redis_url,
            retry=retry,
            retry_on_error=[ConnectionError, TimeoutError],
            socket_timeout=10,
            socket_connect_timeout=5,
            health_check_interval=30,
        )
        log.info("queue.initialized", driver="redis", redis_url=redis_url)

    def get_task(self, queue_name, timeout=0):
        """Pop a task from the queue using BLPOP."""
        item = self.client.blpop(queue_name, timeout=timeout)
        if item:
            task = json.loads(item[1])
            log.debug("queue.task_received", queue=queue_name, job_id=task.get("job_id"))
            return task
        return None

    def complete_task(self, receipt):
        """No-op for Redis — BLPOP already removed the item."""
        pass

    def heartbeat(self, receipt, visibility_timeout=600):
        """No-op for Redis — no visibility timeout concept."""
        pass

    def push_task(self, queue_name, task_data):
        """Push a task back to the queue (used for re-queuing interrupted jobs)."""
        if isinstance(task_data, str):
            self.client.lpush(queue_name, task_data)
        else:
            self.client.lpush(queue_name, json.dumps(task_data))
        log.info("queue.requeued", queue=queue_name, job_id=task_data.get("job_id") if isinstance(task_data, dict) else None)


class SQSQueueService:
    """Queue backend using AWS SQS — used in production.

    Messages are NOT deleted upon receive. Instead:
    - `complete_task()` deletes the message after successful processing.
    - `heartbeat()` extends the visibility timeout during long-running jobs.
    - If the worker crashes, the message reappears after the visibility timeout
      expires and will be retried (up to maxReceiveCount before hitting the DLQ).
    """

    def __init__(self, queue_url, region="us-east-1"):
        self.queue_url = queue_url
        self.client = boto3.client("sqs", region_name=region)
        log.info("queue.initialized", driver="sqs", queue_url=queue_url)

    def get_task(self, queue_name, timeout=0):
        """Receive a message from SQS. Does NOT delete it — call complete_task() after processing."""
        wait_time = min(timeout, 20) if timeout > 0 else 20

        response = self.client.receive_message(
            QueueUrl=self.queue_url,
            MaxNumberOfMessages=1,
            WaitTimeSeconds=wait_time,
        )

        messages = response.get("Messages", [])
        if not messages:
            return None

        msg = messages[0]
        task = json.loads(msg["Body"])

        # Attach receipt handle to the task so we can delete/extend later
        task["_receipt_handle"] = msg["ReceiptHandle"]

        log.debug("queue.task_received", queue=queue_name, job_id=task.get("job_id"))
        return task

    def complete_task(self, receipt):
        """Delete the message from SQS after successful processing."""
        if not receipt:
            return
        try:
            self.client.delete_message(
                QueueUrl=self.queue_url,
                ReceiptHandle=receipt,
            )
            log.debug("queue.task_completed")
        except Exception as e:
            log.error("queue.complete_failed", error=str(e))

    def heartbeat(self, receipt, visibility_timeout=600):
        """Extend the visibility timeout to keep the message in-flight.

        Call this periodically during long-running jobs to prevent SQS from
        re-delivering the message to another consumer.
        """
        if not receipt:
            return
        try:
            self.client.change_message_visibility(
                QueueUrl=self.queue_url,
                ReceiptHandle=receipt,
                VisibilityTimeout=visibility_timeout,
            )
            log.debug("queue.heartbeat_sent", new_visibility=visibility_timeout)
        except Exception as e:
            log.warning("queue.heartbeat_failed", error=str(e))

    def push_task(self, queue_name, task_data):
        """Re-queue a task by sending it back to SQS."""
        # Strip internal metadata before re-queuing
        if isinstance(task_data, dict):
            clean = {k: v for k, v in task_data.items() if not k.startswith("_")}
            body = json.dumps(clean)
        elif isinstance(task_data, str):
            body = task_data
        else:
            body = json.dumps(task_data)

        self.client.send_message(
            QueueUrl=self.queue_url,
            MessageBody=body,
        )
        log.info("queue.requeued", queue=queue_name, job_id=task_data.get("job_id") if isinstance(task_data, dict) else None)


def create_queue(driver, redis_url=None, sqs_queue_url=None, sqs_region="us-east-1"):
    """Factory: returns the right queue implementation based on QUEUE_DRIVER."""
    if driver == "sqs":
        if not sqs_queue_url:
            raise ValueError("SQS_QUEUE_URL must be set when QUEUE_DRIVER=sqs")
        return SQSQueueService(sqs_queue_url, region=sqs_region)
    else:
        return RedisQueueService(redis_url or "redis://localhost:6379/0")
