import http.client
import importlib.util
import io
from pathlib import Path
import ssl
import urllib.error
from unittest.mock import Mock

import pytest
import httpx

spec = importlib.util.spec_from_file_location('production_smoke', Path(__file__).parents[1] / 'scripts/production_smoke.py')
smoke = importlib.util.module_from_spec(spec)
spec.loader.exec_module(smoke)


class Response:
    status = 200
    def __enter__(self): return self
    def __exit__(self, *args): return False
    def read(self, _): return b'{"status":"ok"}'


@pytest.mark.parametrize('method', ['GET', 'DELETE'])
def test_only_idempotent_calls_retry_transport_loss(monkeypatch, method):
    opener = Mock(side_effect=[urllib.error.URLError(ssl.SSLEOFError(8, 'EOF')), http.client.RemoteDisconnected('closed'), Response()])
    monkeypatch.setattr(smoke.urllib.request, 'urlopen', opener)
    monkeypatch.setattr(smoke.time, 'sleep', lambda _: None)
    api = smoke.Api('https://openacad.xyz', 30)
    assert api.request('/api/jobs/opaque-id', token='not-recorded', method=method)[0] == 200
    assert opener.call_count == 3
    assert len(api.transport_retries) == 2
    assert all(e['path'] == '/api/jobs/{id}' for e in api.transport_retries)
    assert 'not-recorded' not in str(api.transport_retries)


def test_post_with_uncertain_response_is_never_retried(monkeypatch):
    opener = Mock(side_effect=urllib.error.URLError(ssl.SSLEOFError(8, 'EOF')))
    monkeypatch.setattr(smoke.urllib.request, 'urlopen', opener)
    with pytest.raises(urllib.error.URLError):
        smoke.Api('https://openacad.xyz', 30).request('/api/jobs', {'kind': 'analysis'})
    assert opener.call_count == 1


def test_certificate_failure_is_never_retried_or_disabled(monkeypatch):
    opener = Mock(side_effect=urllib.error.URLError(ssl.SSLCertVerificationError(1, 'invalid certificate')))
    monkeypatch.setattr(smoke.urllib.request, 'urlopen', opener)
    with pytest.raises(urllib.error.URLError):
        smoke.Api('https://openacad.xyz', 30).request('/api/health')
    assert opener.call_count == 1
    assert 'context' not in opener.call_args.kwargs


def test_http_business_errors_remain_visible_without_retry(monkeypatch):
    opener = Mock(side_effect=urllib.error.HTTPError('https://openacad.xyz/api/health', 503, 'maintenance', {}, io.BytesIO(b'{"message":"maintenance"}')))
    monkeypatch.setattr(smoke.urllib.request, 'urlopen', opener)
    assert smoke.Api('https://openacad.xyz', 30).request('/api/health') == (503, {'message': 'maintenance'})
    assert opener.call_count == 1


def test_transient_retries_are_bounded(monkeypatch):
    opener = Mock(side_effect=TimeoutError('timed out'))
    monkeypatch.setattr(smoke.urllib.request, 'urlopen', opener)
    pauses = []
    monkeypatch.setattr(smoke.time, 'sleep', pauses.append)
    with pytest.raises(TimeoutError):
        smoke.Api('https://openacad.xyz', 30).request('/api/health')
    assert opener.call_count == 4
    assert pauses == [0.5, 1, 2]


@pytest.mark.parametrize('method,expected_calls', [('GET', 2), ('DELETE', 2), ('POST', 1)])
def test_pooled_client_has_the_same_safe_retry_contract(monkeypatch, method, expected_calls):
    calls, client_options = [], []
    actual_client = httpx.Client
    def handler(request):
        calls.append(request)
        if len(calls) == 1:
            raise httpx.ReadError('connection closed')
        return httpx.Response(200, json={'status':'ok'})
    def factory(**kwargs):
        client_options.append(kwargs)
        return actual_client(transport=httpx.MockTransport(handler), trust_env=False)
    monkeypatch.setattr(smoke.httpx, 'Client', factory)
    monkeypatch.setattr(smoke.time, 'sleep', lambda _: None)
    api = smoke.Api('https://openacad.xyz', 30, pooled=True)
    try:
        if method == 'POST':
            with pytest.raises(httpx.ReadError):
                api.request('/api/jobs', {'kind':'analysis'}, method=method)
        else:
            assert api.request('/api/health', method=method)[0] == 200
        assert len(calls) == expected_calls
        assert client_options[0]['verify'] is True
        assert client_options[0]['trust_env'] is True
    finally:
        api.close()


def test_pooled_certificate_error_keeps_original_failure(monkeypatch):
    actual_client, calls = httpx.Client, []
    def handler(request):
        calls.append(request)
        raise httpx.ConnectError('TLS handshake failed') from ssl.SSLCertVerificationError(1, 'invalid certificate')
    monkeypatch.setattr(smoke.httpx, 'Client', lambda **_: actual_client(transport=httpx.MockTransport(handler), trust_env=False))
    api = smoke.Api('https://openacad.xyz', 30, pooled=True)
    try:
        with pytest.raises(httpx.ConnectError):
            api.request('/api/health')
        assert len(calls) == 1
        assert api.transport_retries == []
    finally:
        api.close()
