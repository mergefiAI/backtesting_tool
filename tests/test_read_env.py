import unittest
from cfg.config import get_settings



class TestBacktestUtils(unittest.TestCase):

    def test_read_env(self):
        settings = get_settings()
        print(settings.api_port)
