import json
import pathlib
import sys
from playwright.sync_api import sync_playwright, expect

origin, root, executable = sys.argv[1:]
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path=executable)
    try:
        page = browser.new_page(viewport={"width": 1440, "height": 1000})
        faults = []
        page.on('pageerror', lambda error: faults.append(str(error)))
        page.on('console', lambda message: faults.append(message.text) if message.type == 'error' else None)
        page.goto(origin, wait_until='domcontentloaded')
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
        assert faults == [], faults
        print(json.dumps({"orphanInterrupted": True, "activeRunning": True, "stopRemoved": True, "activeArchiveBlocked": True, "orphanArchived": True, "faults": faults}))
    finally:
        browser.close()
