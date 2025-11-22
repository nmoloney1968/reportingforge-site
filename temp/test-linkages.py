import requests

BASE_URL = "https://reportingforge.com/api/skylink"

resp = requests.get(f"{BASE_URL}/sites.json")
resp.raise_for_status()

data = resp.json()
print("Network:", data["network_name"])
print("First site:", data["sites"][0])
