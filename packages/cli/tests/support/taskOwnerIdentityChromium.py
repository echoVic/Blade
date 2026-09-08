import json
import pathlib
import sys
from urllib.parse import urlencode, urlparse
from playwright.sync_api import sync_playwright, expect

origin, root, executable = sys.argv[1:]
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path=executable)
    try:
        page = browser.new_page(viewport={"width": 1440, "height": 1000})
        faults = []
        page.on('pageerror', lambda error: faults.append(str(error)))
        page.on('console', lambda message: faults.append(message.text) if message.type == 'error' else None)
        foreground_response = page.request.post(f'{origin}/sessions', data={
            'projectPath': str(pathlib.Path(root) / 'team-project_with_underscore'),
            'title': 'SURFACE FOREGROUND',
        })
        assert foreground_response.ok, foreground_response.text()
        foreground = foreground_response.json()
        selected_url = f'{origin}/?{urlencode({"session": foreground["sessionId"], "project": foreground["projectPath"]})}'
        with page.expect_response(lambda response: urlparse(response.url).path == '/sessions/v2/catalog') as initial_catalog:
            page.goto(selected_url, wait_until='domcontentloaded')
        assert initial_catalog.value.ok, initial_catalog.value.text()
        page.locator('textarea[data-blade-composer]').wait_for(timeout=30000)
        selected_url = page.url
        document = page.evaluate('performance.timeOrigin')
        observer_context = browser.new_context(viewport={"width": 1440, "height": 1000})
        observer = observer_context.new_page()
        observer.on('pageerror', lambda error: faults.append(str(error)))
        observer.on('console', lambda message: faults.append(message.text) if message.type == 'error' else None)
        with observer.expect_response(lambda response: urlparse(response.url).path == '/sessions/v2/catalog') as observer_catalog:
            observer.goto(selected_url, wait_until='domcontentloaded')
        assert observer_catalog.value.ok, observer_catalog.value.text()
        observer.locator('textarea[data-blade-composer]').wait_for(timeout=30000)
        observer_document = observer.evaluate('performance.timeOrigin')
        orphan = page.get_by_role('button', name='选择「OWNER ORPHAN」')
        active = page.get_by_role('button', name='选择「OWNER ACTIVE」')
        orphan.wait_for(timeout=30000)
        expect(orphan.locator('[title="interrupted"]')).to_have_count(1)
        expect(active.locator('[title="running"]')).to_have_count(1)
        expect(page.get_by_role('button', name='停止「OWNER ORPHAN」')).to_have_count(0)
        expect(page.get_by_role('button', name='停止「OWNER ACTIVE」').first).to_be_visible()
        page.screenshot(path=str(pathlib.Path(root) / 'initial.png'), full_page=True)
        page.get_by_role('button', name='「OWNER ACTIVE」的更多操作').click()
        expect(page.get_by_role('menuitem', name='归档「OWNER ACTIVE」')).to_be_disabled()
        page.keyboard.press('Escape')
        page.get_by_role('button', name='「OWNER ORPHAN」的更多操作').click()
        archive = page.get_by_role('menuitem', name='归档「OWNER ORPHAN」')
        expect(archive).to_be_enabled()
        with page.expect_response(lambda response: '/archive' in response.url and response.request.method == 'POST') as archive_response:
            archive.click()
        response = archive_response.value
        assert response.ok, response.text()
        expect(orphan).to_have_count(0)
        expect(active).to_be_visible()
        page.screenshot(path=str(pathlib.Path(root) / 'archived.png'), full_page=True)
        expect(observer.get_by_role('button', name='选择「OWNER ORPHAN」')).to_have_count(0)

        created_response = observer.request.post(f'{origin}/sessions', data={
            'projectPath': foreground['projectPath'],
            'title': 'SURFACE LIFECYCLE',
        })
        assert created_response.ok, created_response.text()
        created = created_response.json()
        endpoint = f'/sessions/{created["sessionId"]}'
        lifecycle = page.get_by_role('button', name='选择「SURFACE LIFECYCLE」', exact=True)
        observed_lifecycle = observer.get_by_role('button', name='选择「SURFACE LIFECYCLE」', exact=True)
        expect(lifecycle).to_be_visible(timeout=30000)
        expect(observed_lifecycle).to_be_visible(timeout=30000)
        page.screenshot(path=str(pathlib.Path(root) / 'created-live.png'), full_page=True)

        page.get_by_role('button', name='「SURFACE LIFECYCLE」的更多操作').click()
        with page.expect_response(lambda response: urlparse(response.url).path == f'{endpoint}/archive' and response.request.method == 'POST') as lifecycle_archive:
            page.get_by_role('menuitem', name='归档「SURFACE LIFECYCLE」', exact=True).click()
        assert lifecycle_archive.value.ok, lifecycle_archive.value.text()
        expect(lifecycle).to_have_count(0)
        expect(observed_lifecycle).to_have_count(0)

        page.get_by_role('button', name='打开会话归档').click()
        with page.expect_response(lambda response: urlparse(response.url).path == f'{endpoint}/unarchive' and response.request.method == 'POST') as lifecycle_restore:
            page.get_by_role('button', name='恢复「SURFACE LIFECYCLE」', exact=True).click()
        assert lifecycle_restore.value.ok, lifecycle_restore.value.text()
        page.keyboard.press('Escape')
        expect(lifecycle).to_be_visible(timeout=30000)
        expect(observed_lifecycle).to_be_visible(timeout=30000)
        page.screenshot(path=str(pathlib.Path(root) / 'restored-live.png'), full_page=True)

        page.get_by_role('button', name='「SURFACE LIFECYCLE」的更多操作').click()
        with page.expect_response(lambda response: urlparse(response.url).path == endpoint and response.request.method == 'DELETE') as lifecycle_delete:
            page.get_by_role('menuitem', name='删除「SURFACE LIFECYCLE」', exact=True).click()
        assert lifecycle_delete.value.ok, lifecycle_delete.value.text()
        expect(lifecycle).to_have_count(0)
        expect(observed_lifecycle).to_have_count(0)
        for current, original_document in [(page, document), (observer, observer_document)]:
            assert current.url == selected_url, current.url
            assert current.evaluate('performance.timeOrigin') == original_document
            expect(current.get_by_role('button', name='选择「OWNER ACTIVE」')).to_be_visible()
            expect(current.locator('textarea[data-blade-composer]')).to_be_visible()
        observer.screenshot(path=str(pathlib.Path(root) / 'deleted-live-observer.png'), full_page=True)
        assert faults == [], faults
        print(json.dumps({"orphanInterrupted": True, "activeRunning": True, "stopRemoved": True, "activeArchiveBlocked": True, "orphanArchived": True, "lifecycle": {"createdWithoutReload": True, "archivedAcrossPages": True, "restoredAcrossPages": True, "deletedAcrossPages": True, "selectionPreserved": True}, "faults": faults}))
    finally:
        browser.close()
