import threading

from cfg import logger


def run_task_thread(task_id: str, target_func, args: tuple = ()) -> threading.Thread:
    def thread_wrapper():
        logger.info(f"线程已启动: {target_func.__name__} with args {args}")
        try:
            if len(args) == 0:
                target_func(task_id, logger)
            elif len(args) == 1:
                target_func(args[0], logger)
            else:
                target_func(*args, logger)
        except Exception as e:
            logger.error(f"线程执行失败: {e}")
            raise

    th = threading.Thread(target=thread_wrapper, daemon=True)
    th.start()
    return th

