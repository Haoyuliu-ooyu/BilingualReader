import redis
import json

class QueueService:
    def __init__(self, redis_addr):
        host, port = redis_addr.split(":")
        self.client = redis.Redis(host=host, port=int(port), db=0)

    def get_task(self, queue_name, timeout=0):
        # BLPOP returns a tuple (queue_name, data)
        item = self.client.blpop(queue_name, timeout=timeout)
        if item:
            return json.loads(item[1])
        return None
