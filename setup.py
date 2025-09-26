from setuptools import setup, find_packages

with open("README.md", "w") as f:
    f.write("Workbench — Notion-style editor for Frappe")

setup(
    name="workbench",
    version="0.0.1",
    description="Notion-style editor for Frappe",
    author="You",
    packages=find_packages(),
    include_package_data=True,
    zip_safe=False,
)
