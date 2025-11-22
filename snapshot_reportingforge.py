import os
from urllib.parse import urljoin
from urllib.request import urlopen
from urllib.error import URLError, HTTPError

BASE_URL = "https://reportingforge.com/"

# Explicit list of pages/assets that make up the whole site
FILES = [
    ("", "index.html"),
    ("about.html", "about.html"),
    ("docs.html", "docs.html"),
    ("early-access.html", "early-access.html"),
    ("roadmap.html", "roadmap.html"),
    ("changelog.html", "changelog.html"),
    ("privacy.html", "privacy.html"),
    ("terms.html", "terms.html"),
    ("404.html", "404.html"),
    ("styles.css", "styles.css"),
    ("favicon.svg", "favicon.svg"),
]

OUTPUT_DIR = "reportingforge-site-snapshot"


def download_file(path: str, filename: str) -> None:
    url = urljoin(BASE_URL, path)
    out_path = os.path.join(OUTPUT_DIR, filename)

    try:
        print(f"Downloading {url} -> {out_path}")
        with urlopen(url) as resp:
            data = resp.read()
    except HTTPError as e:
        print(f"  HTTP error {e.code} for {url}")
        return
    except URLError as e:
        print(f"  URL error for {url}: {e.reason}")
        return

    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "wb") as f:
        f.write(data)


def main() -> None:
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    for path, filename in FILES:
        download_file(path, filename)

    print("\nDone. Snapshot written to:", os.path.abspath(OUTPUT_DIR))


if __name__ == "__main__":
    main()
