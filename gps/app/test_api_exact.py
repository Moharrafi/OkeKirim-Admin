import requests
from datetime import datetime, timedelta

def test():
    user = "GLONASS_USERNAME_REMOVED"
    pwd = "GLONASS_PASSWORD_REMOVED"
    sess = requests.Session()
    resp = sess.post("https://hosting.glonasssoft.ru/api/v3/auth/login", json={"login": user, "password": pwd})
    token = resp.json().get("AuthId")
    sess.headers.update({
        "X-Auth": token,
        "AuthId": token,
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    })
    
    vid = "8a8ac838-89d9-48e0-a1ca-227c5f3f8a7c" # id object
    
    date_from = (datetime.now() - timedelta(days=2)).strftime("%Y-%m-%dT00:00:00.000Z")
    date_to = datetime.now().strftime("%Y-%m-%dT23:59:59.999Z")
    
    url = "https://hosting.glonasssoft.ru/api/history/points"
    params = {
        "vehicleId": 456037,
        "start": date_from,
        "end": date_to
    }
    
    print(f"Testing GET {url} with {params}")
    r = sess.get(url, params=params)
    print(f"[{r.status_code}]")
    if r.status_code == 200:
        data = r.json()
        if isinstance(data, list):
            print(f"SUCCESS: List length = {len(data)}")
            if len(data) > 0:
                print("First item:", data[0])
        else:
            print(f"SUCCESS (type {type(data)}):", str(data)[:1000])
    else:
        print(r.text[:200])

if __name__ == "__main__":
    test()
