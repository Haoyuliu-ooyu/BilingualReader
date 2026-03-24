import json

import redis
import structlog
from redis.backoff import ExponentialBackoff
from redis.exceptions import ConnectionError, TimeoutError
from redis.retry import Retry

log = structlog.get_logger("worker.queue")


class QueueService:
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
        log.info("queue.initialized", redis_url=redis_url)

    def get_task(self, queue_name, timeout=0):
        """Pop a task from the queue using BLPOP."""
        item = self.client.blpop(queue_name, timeout=timeout)
        if item:
            task = json.loads(item[1])
            log.debug("queue.task_received", queue=queue_name, job_id=task.get("job_id"))
            return task
        return None

    def push_task(self, queue_name, task_data):
        """Push a task back to the queue (used for re-queuing interrupted jobs)."""
        if isinstance(task_data, str):
            self.client.lpush(queue_name, task_data)
        else:
            self.client.lpush(queue_name, json.dumps(task_data))
        log.info("queue.requeued", queue=queue_name, job_id=task_data.get("job_id") if isinstance(task_data, dict) else None)
