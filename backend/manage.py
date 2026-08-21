#!/usr/bin/env python
"""Django's command-line utility for administrative tasks."""

import os
import sys


def _patch_django_context_copy():
    try:
        from django.template.context import Context
        def custom_copy(self):
            duplicate = type(self)()
            duplicate.dicts = self.dicts[:]
            return duplicate
        Context.__copy__ = custom_copy
    except ImportError:
        pass


def main():
    """Run administrative tasks."""
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
    _patch_django_context_copy()
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Couldn't import Django. Are you sure it's installed and that you "
            "have activated the virtual environment?"
        ) from exc
    execute_from_command_line(sys.argv)


if __name__ == "__main__":
    main()
