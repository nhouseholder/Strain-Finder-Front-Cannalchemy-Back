#!/usr/bin/env python3
"""Add mystrainai.com to Firebase Auth authorized domains."""
import json, time, base64, urllib.request, urllib.parse, sys, os

SA_PATH = os.path.expanduser("~/Downloads/mystrainai-firebase-adminsdk-fbsvc-828d11db4a.json")
PROJECT_ID = "mystrainai"
DOMAINS_TO_ADD = ["mystrainai.com", "www.mystrainai.com", "mystrainai.pages.dev"]

def get_access_token(sa):
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import padding

    def b64url(data):
        return base64.urlsafe_b64encode(data).rstrip(b"=").decode()

    header = b64url(json.dumps({"alg": "RS256", "typ": "JWT"}).encode())
    now = int(time.time())
    claims = b64url(json.dumps({
        "iss": sa["client_email"],
        "scope": "https://www.googleapis.com/auth/firebase https://www.googleapis.com/auth/identitytoolkit https://www.googleapis.com/auth/cloud-platform",
        "aud": sa["token_uri"],
        "iat": now,
        "exp": now + 3600,
    }).encode())
    unsigned = f"{header}.{claims}".encode()
    key = serialization.load_pem_private_key(sa["private_key"].encode(), password=None)
    sig = key.sign(unsigned, padding.PKCS1v15(), hashes.SHA256())
    jwt_token = f"{header}.{claims}.{b64url(sig)}"

    data = urllib.parse.urlencode({
        "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
        "assertion": jwt_token,
    }).encode()
    req = urllib.request.Request(sa["token_uri"], data=data, headers={"Content-Type": "application/x-www-form-urlencoded"})
    resp = json.loads(urllib.request.urlopen(req).read())
    return resp["access_token"]


def api_call(token, url, method="GET", body=None):
    req = urllib.request.Request(url, method=method, headers={
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    })
    if body:
        req.data = json.dumps(body).encode()
    try:
        resp = urllib.request.urlopen(req)
        return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        print(f"HTTP {e.code}: {e.read().decode()[:500]}", file=sys.stderr)
        raise


def main():
    sa = json.load(open(SA_PATH))
    token = get_access_token(sa)
    print("Got access token")

    # Get current Identity Toolkit config
    url = f"https://identitytoolkit.googleapis.com/admin/v2/projects/{PROJECT_ID}/config"
    config = api_call(token, url)
    
    current_domains = config.get("authorizedDomains", [])
    print(f"Current authorized domains: {current_domains}")

    # Add new domains
    new_domains = list(current_domains)
    for d in DOMAINS_TO_ADD:
        if d not in new_domains:
            new_domains.append(d)
            print(f"  Adding: {d}")

    if new_domains == current_domains:
        print("All domains already authorized!")
        return

    # Update config with new authorized domains
    update_url = f"https://identitytoolkit.googleapis.com/admin/v2/projects/{PROJECT_ID}/config?updateMask=authorizedDomains"
    result = api_call(token, update_url, method="PATCH", body={"authorizedDomains": new_domains})
    print(f"Updated authorized domains: {result.get('authorizedDomains', [])}")
    print("Done!")


if __name__ == "__main__":
    main()
