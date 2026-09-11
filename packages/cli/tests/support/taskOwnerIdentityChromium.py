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
        expected_install_errors = []
        catalog_requests = []
        catalog_console_errors = []
        catalog_failures = []
        page.on('request', lambda request: catalog_requests.append(request.url) if urlparse(request.url).path == '/skills/catalog' else None)
        def collect_console(message):
            if message.type != 'error':
                return
            location = message.location
            if urlparse(location.get('url', '')).path == '/skills/install' and '400 (Bad Request)' in message.text:
                expected_install_errors.append(message.text)
            elif urlparse(location.get('url', '')).path == '/skills/catalog' and '502 (Bad Gateway)' in message.text:
                catalog_console_errors.append(message.text)
            elif message.text.startswith('HttpResponseError: GitHub skills catalog returned '):
                catalog_console_errors.append(message.text)
            else:
                faults.append(message.text)
        page.on('pageerror', lambda error: faults.append(str(error)))
        page.on('console', collect_console)
        foreground_response = page.request.post(f'{origin}/sessions', data={
            'projectPath': str(pathlib.Path(root) / 'team-project_with_underscore'),
            'title': 'SURFACE FOREGROUND',
        })
        assert foreground_response.ok, foreground_response.text()
        foreground = foreground_response.json()
        selected_url = f'{origin}/?{urlencode({"session": foreground["sessionId"], "project": foreground["projectPath"]})}'
        held_global_events = []
        page.route(f'{origin}/events', lambda route: held_global_events.append(route))
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
        assert len(held_global_events) == 1, held_global_events
        gap_response = observer.request.post(f'{origin}/sessions', data={
            'projectPath': foreground['projectPath'],
            'title': 'SURFACE HANDSHAKE GAP',
        })
        assert gap_response.ok, gap_response.text()
        expect(observer.get_by_role('button', name='选择「SURFACE HANDSHAKE GAP」', exact=True)).to_be_visible(timeout=30000)
        gap = page.get_by_role('button', name='选择「SURFACE HANDSHAKE GAP」', exact=True)
        expect(gap).to_have_count(0)
        held_global_events[0].continue_()
        page.unroute(f'{origin}/events')
        expect(gap).to_be_visible(timeout=10000)
        page.screenshot(path=str(pathlib.Path(root) / 'handshake-gap-recovered.png'), full_page=True)
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
        switcher_tasks = []
        for title in ['SWITCHER ONE', 'SWITCHER TWO']:
            response = observer.request.post(f'{origin}/sessions', data={'projectPath': foreground['projectPath'], 'title': title})
            assert response.ok, response.text()
            switcher_tasks.append(response.json())
        page.keyboard.press('Control+k')
        task_search = page.get_by_role('combobox', name='搜索任务', exact=True)
        task_search.fill('SWITCHER')
        options = page.locator('[role="option"]')
        highlighted = page.locator('[role="option"][aria-selected="true"]')
        expect(options).to_have_count(2)
        expect(highlighted).to_contain_text('SWITCHER TWO')
        ime = page.context.new_cdp_session(page)
        ime_evidence = []
        for mode, query in [('tasks', 'SWITCHER'), ('commands', '设置')]:
            mode_tab = page.get_by_role('tab', name='任务' if mode == 'tasks' else '操作', exact=True)
            mode_tab.click()
            expect(mode_tab).to_have_attribute('aria-selected', 'true')
            search = page.get_by_role('combobox')
            search.fill('')
            search.evaluate('''input => {
                input.dataset.imeEvents = '[]';
                for (const type of ['compositionstart', 'compositionend', 'keydown']) {
                    input.addEventListener(type, event => {
                        const events = JSON.parse(input.dataset.imeEvents);
                        events.push({type, trusted: event.isTrusted, key: event.key, composing: event.isComposing});
                        input.dataset.imeEvents = JSON.stringify(events);
                    });
                }
            }''')
            for key in ['ArrowDown', 'ArrowUp', 'Escape', 'Enter']:
                ime.send('Input.imeSetComposition', {'text': query, 'selectionStart': 0, 'selectionEnd': len(query)})
                expect(search).to_have_value(query)
                expect(highlighted).to_have_count(1)
                before = search.get_attribute('aria-activedescendant')
                search.press(key)
                expect(search).to_be_visible()
                assert search.get_attribute('aria-activedescendant') == before
                expect(page).to_have_url(selected_url)
            events = json.loads(search.get_attribute('data-ime-events'))
            assert any(event['type'] == 'compositionstart' and event['trusted'] for event in events), events
            for key in ['ArrowDown', 'ArrowUp', 'Escape', 'Enter']:
                assert any(event.get('key') == key and event.get('composing') and event['trusted'] for event in events), events
            ime.send('Input.imeSetComposition', {'text': '', 'selectionStart': 0, 'selectionEnd': 0})
            search.press('Escape')
            expect(search).to_have_count(0)
            ime_evidence.append({'mode': mode, 'trustedComposition': True, 'candidateKeysIsolated': True, 'ordinaryEscapeCloses': True})
            if mode == 'tasks':
                page.keyboard.press('Control+k')
        ime.detach()
        page.keyboard.press('Control+k')
        task_search.fill('SWITCHER')
        expect(highlighted).to_contain_text('SWITCHER TWO')
        task_search.press('ArrowDown')
        expect(highlighted).to_contain_text('SWITCHER ONE')
        archived_switcher = observer.request.post(f'{origin}/sessions/{switcher_tasks[1]["sessionId"]}/archive', params={'projectPath': foreground['projectPath']})
        assert archived_switcher.ok, archived_switcher.text()
        expect(options).to_have_count(1)
        expect(highlighted).to_contain_text('SWITCHER ONE')
        inserted_switcher = observer.request.post(f'{origin}/sessions', data={'projectPath': foreground['projectPath'], 'title': 'SWITCHER THREE'})
        assert inserted_switcher.ok, inserted_switcher.text()
        expect(options).to_have_count(2)
        expect(options.first).to_contain_text('SWITCHER THREE')
        expect(highlighted).to_contain_text('SWITCHER ONE')
        page.screenshot(path=str(pathlib.Path(root) / 'switcher-selection-preserved.png'), full_page=True)
        archived_selected = observer.request.post(f'{origin}/sessions/{switcher_tasks[0]["sessionId"]}/archive', params={'projectPath': foreground['projectPath']})
        assert archived_selected.ok, archived_selected.text()
        expect(options).to_have_count(1)
        expect(highlighted).to_contain_text('SWITCHER THREE')
        task_search.fill('no matching switcher task')
        expect(options).to_have_count(0)
        assert task_search.get_attribute('aria-activedescendant') is None
        task_search.press('Enter')
        expect(task_search).to_be_visible()
        task_search.fill('SWITCHER THREE')
        expect(highlighted).to_contain_text('SWITCHER THREE')
        task_search.press('Enter')
        expect(task_search).to_have_count(0)
        expect(page).to_have_url(f'{origin}/?{urlencode({"session": inserted_switcher.json()["sessionId"], "project": foreground["projectPath"]})}')
        page.keyboard.press('Control+k')
        page.get_by_role('combobox', name='搜索任务', exact=True).fill('SURFACE FOREGROUND')
        page.get_by_role('combobox', name='搜索任务', exact=True).press('Enter')
        expect(page).to_have_url(selected_url)
        page.locator('[data-settings-trigger]').click()
        with page.expect_response(lambda response: urlparse(response.url).path == '/skills' and response.request.method == 'GET') as skills_response:
            page.get_by_role('tab', name='技能', exact=True).click()
        assert skills_response.value.ok, skills_response.value.text()
        skills = skills_response.value.json()
        assert {skill['name'] for skill in skills} == {'skill-creator', 'update-config'}, skills
        assert all(skill['location'] == 'Built-in' and not skill['removable'] for skill in skills), skills
        panel = page.locator('#settings-panel-skills')
        panel.get_by_role('button').filter(has_text='skill-creator').click()
        expect(panel.get_by_text('Built-in', exact=True)).to_be_visible()
        expect(panel.get_by_role('button', name='受管理', exact=True)).to_be_disabled()
        assert not (pathlib.Path(root) / 'home' / '.blade' / 'skills').exists()
        page.screenshot(path=str(pathlib.Path(root) / 'bundled-skills.png'), full_page=True)
        assert catalog_requests == [], catalog_requests
        with page.expect_response(lambda response: urlparse(response.url).path == '/skills' and response.request.method == 'GET') as refreshed_skills:
            panel.get_by_role('button', name='刷新技能', exact=True).click()
        assert refreshed_skills.value.ok
        assert catalog_requests == [], catalog_requests

        marker = pathlib.Path(root) / 'unexpected-command'
        with page.expect_response(lambda response: urlparse(response.url).path == '/skills/catalog') as catalog_response:
            panel.get_by_role('button', name='安装技能', exact=True).click()
        rejected_install = page.get_by_role('dialog', name='安装技能', exact=True)
        response = catalog_response.value
        if not response.ok:
            assert response.status == 502, response.text()
            error = response.json()['error']
            expect(rejected_install.get_by_role('alert')).to_contain_text(error)
            expect(rejected_install.get_by_role('button', name='安装', exact=True)).to_be_disabled()
            catalog_failures.append(error)
            with page.expect_response(lambda response: urlparse(response.url).path == '/skills/catalog') as retried_catalog:
                rejected_install.get_by_role('button', name='重试', exact=True).click()
            retry = retried_catalog.value
            if not retry.ok:
                assert retry.status == 502, retry.text()
                error = retry.json()['error']
                expect(rejected_install.get_by_role('alert')).to_contain_text(error)
                catalog_failures.append(error)
            else:
                expect(rejected_install.get_by_role('alert')).to_have_count(0)
        else:
            assert isinstance(response.json(), list)
            expect(rejected_install.get_by_role('alert')).to_have_count(0)
        request_count = len(catalog_requests)
        assert request_count == 1 + (1 if catalog_failures else 0), catalog_requests
        rejected_install.get_by_role('button', name='仓库', exact=True).click()
        rejected_install.get_by_role('textbox', name='技能仓库地址').fill(f'ext::touch {marker}')
        rejected_install.get_by_role('button', name='安装', exact=True).click()
        with page.expect_response(lambda response: urlparse(response.url).path == '/skills/install' and response.request.method == 'POST') as rejected:
            page.get_by_role('dialog', name='安装状态', exact=True).get_by_role('button', name='安装', exact=True).click()
        assert rejected.value.status == 400, rejected.value.text()
        status = page.get_by_role('dialog', name='安装状态', exact=True)
        expect(status.get_by_text('Skill repositories must use HTTPS or SSH without embedded credentials', exact=True)).to_be_visible()
        assert not marker.exists()
        assert not (pathlib.Path(root) / 'home' / '.blade' / 'skills').exists()
        page.screenshot(path=str(pathlib.Path(root) / 'unsafe-skill-rejected.png'), full_page=True)
        status.get_by_role('button', name='关闭', exact=True).click()
        rejected_install.get_by_role('button', name='关闭技能安装', exact=True).click()

        local_skill = pathlib.Path(root) / 'local-source' / 'skill-creator'
        local_skill.mkdir(parents=True)
        local_content = '---\nname: skill-creator\ndescription: LOCAL_SKILL_OVERRIDE\nuser-invocable: true\n---\nLocal fixture instructions.\n'
        (local_skill / 'SKILL.md').write_text(local_content)
        outside = pathlib.Path(root) / 'home' / '.blade' / 'outside'
        outside.mkdir()
        (outside / 'keep.txt').write_text('KEEP')
        invalid_name = page.request.post(f'{origin}/skills/install', data={'source': 'local', 'path': str(local_skill), 'name': '../outside'})
        assert invalid_name.status == 400, invalid_name.text()
        assert (outside / 'keep.txt').read_text() == 'KEEP'
        panel.get_by_role('button', name='安装技能', exact=True).click()
        install = page.get_by_role('dialog', name='安装技能', exact=True)
        install.get_by_role('button', name='本地', exact=True).click()
        install.get_by_role('textbox', name='本地技能路径').fill(str(local_skill))
        install.get_by_role('button', name='安装', exact=True).click()
        with page.expect_response(lambda response: urlparse(response.url).path == '/skills/install' and response.request.method == 'POST') as installed:
            page.get_by_role('dialog', name='安装状态', exact=True).get_by_role('button', name='安装', exact=True).click()
        assert installed.value.ok, installed.value.text()
        expect(panel.get_by_role('button', name='卸载', exact=True)).to_be_enabled()
        expect(panel.get_by_text('LOCAL_SKILL_OVERRIDE', exact=True).last).to_be_visible()
        page.screenshot(path=str(pathlib.Path(root) / 'local-skill-installed.png'), full_page=True)
        panel.get_by_role('button', name='卸载', exact=True).click()
        with page.expect_response(lambda response: urlparse(response.url).path == '/skills/skill-creator' and response.request.method == 'DELETE') as removed:
            panel.get_by_role('button', name='卸载技能', exact=True).click()
        assert removed.value.ok, removed.value.text()
        expect(panel.get_by_text('Built-in', exact=True)).to_be_visible()
        expect(panel.get_by_role('button', name='受管理', exact=True)).to_be_disabled()
        assert (local_skill / 'SKILL.md').read_text() == local_content
        assert not (pathlib.Path(root) / 'home' / '.blade' / 'skills' / 'skill-creator').exists()
        page.screenshot(path=str(pathlib.Path(root) / 'bundled-skill-restored.png'), full_page=True)
        assert len(catalog_requests) == request_count, catalog_requests
        if catalog_console_errors:
            assert catalog_failures, catalog_console_errors
        assert faults == [], faults
        print(json.dumps({"orphanInterrupted": True, "activeRunning": True, "stopRemoved": True, "activeArchiveBlocked": True, "orphanArchived": True, "lifecycle": {"handshakeGapRecovered": True, "createdWithoutReload": True, "archivedAcrossPages": True, "restoredAcrossPages": True, "deletedAcrossPages": True, "selectionPreserved": True}, "taskSwitcher": {"insertionPreserved": True, "archivePreserved": True, "removedSelectionReset": True, "emptySearchSafe": True, "enterSelectedExactSession": True, "ime": ime_evidence}, "skills": {"unsafeInstallRejected": True, "traversalRejected": True, "bundledWithoutDownload": True, "explicitLocalInstall": True, "uninstallRestoresBuiltin": True, "localSourcePreserved": True, "catalogRequestedOnDemand": True, "catalogRequests": len(catalog_requests), "catalogFailures": catalog_failures, "catalogConsoleErrors": catalog_console_errors}, "faults": faults}))
    finally:
        browser.close()
