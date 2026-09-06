from rq import Worker
from rq.serializers import JSONSerializer
from .jobs import connection, queue


if __name__ == "__main__":
    conn = connection()
    Worker([queue(conn)], connection=conn, serializer=JSONSerializer).work(with_scheduler=False)
