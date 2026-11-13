"""Pytest configuration for HireFlow.

Provides fixtures for database, authentication, and integration testing.
"""

def pytest_configure(config) -> None:
    """Configure pytest with custom settings."""
    config.addinivalue_line(
        "markers", "db: Database fixture test"
    )
    config.addinivalue_line(
        "markers", "auth: Authentication test"
    )
    config.addinivalue_line(
        "markers", "integration: Integration test"
    )
    config.addinivalue_line(
        "markers", "slow: Slow test (requires DB)"
    )


def pytest_collection_modifyitems(config, items) -> None:
    """Modify collected test items."""
    # Sort tests so db-related tests run first
    db_tests = [item for item in items if "db" in item.keywords]
    other_tests = [item for item in items if "db" not in item.keywords]
    other_tests.extend(db_tests)
    items[:] = other_tests


def pytest_fixture_discovery(config) -> None:
    """Handle fixture discovery."""
    pass