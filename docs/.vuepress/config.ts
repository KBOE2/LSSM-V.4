const fs = require('fs');
const path = require('path');
const copydir = require('copy-dir');

import config from '../../src/config';

const langModules = fs
    .readdirSync('./docs/')
    .filter((x: string) => Object.keys(config.games).indexOf(x) >= 0);

const emptyFolder = (path: string, deleteFolder = true): void => {
    if (fs.existsSync(path)) {
        fs.readdirSync(path).forEach((file: string) => {
            const curPath = path + '/' + file;
            if (fs.lstatSync(curPath).isDirectory()) {
                emptyFolder(curPath, true);
            } else {
                fs.unlinkSync(curPath);
            }
        });
        if (deleteFolder) fs.rmdirSync(path);
    }
}
emptyFolder('./dist/docs');
langModules.forEach((x: string) => emptyFolder(`./docs/${x}/modules`));
emptyFolder('./docs/.vuepress/public/assets', false);

const moduleDirs = fs.readdirSync('./src/modules');
const modulesSorted = {} as {[lang: string]: { title: string, f: string, noMapkit: boolean }[]};
moduleDirs.forEach((module: string) => {
    if (
        module !== 'template' &&
        fs.existsSync(`./src/modules/${module}/docs`)
    ) {
        const docs = fs
            .readdirSync(`./src/modules/${module}/docs`)
            .filter((f: string) => f.match(/^[a-z]{2}_[A-Z]{2}\.md$/));
        docs.forEach((f: string) => {
            const lang = f.split('.')[0];
            if (!modulesSorted.hasOwnProperty(lang)) modulesSorted[lang] = [];
            if (!fs.existsSync(`./docs/${lang}/modules`))
                fs.mkdirSync(`./docs/${lang}/modules`);
            const title = require(`../../src/modules/${module}/i18n/${lang}.root`)
                .name;
            modulesSorted[lang].push({
                title,
                f: `${lang}/modules/${f.replace(lang, module)}`,
                noMapkit: require(`../../src/modules/${module}/register`)
                    .noMapkit,
            });
            fs.copyFileSync(
                // @ts-ignore
                path.join(__dirname, `../../src/modules/${module}/docs/${f}`),
                `./docs/${lang}/modules/${f.replace(lang, module)}`
            );
            const content = fs
                .readFileSync(
                    `./docs/${lang}/modules/${f.replace(lang, module)}`
                )
                .toString();
            fs.writeFileSync(
                `./docs/${lang}/modules/${f.replace(lang, module)}`,
                `---
title: ${title}
lang: ${lang}
---

# ${title}

${content}`
            );
        });
        if (!fs.existsSync(`./docs/.vuepress/public/assets`))
            fs.mkdirSync(`./docs/.vuepress/public/assets`);
        if (fs.existsSync(`./src/modules/${module}/docs/assets`)) {
            if (!fs.existsSync(`./docs/.vuepress/public/assets/${module}`))
                fs.mkdirSync(`./docs/.vuepress/public/assets/${module}`);
            copydir.sync(
                `./src/modules/${module}/docs/assets`,
                `./docs/.vuepress/public/assets/${module}`
            );
        }
    }
});
const noMapkitModules = {} as {[lang: string]: { title: string, f: string }[]};
Object.keys(modulesSorted).forEach(lang => {
    noMapkitModules[lang] = [
        ...Object.values(modulesSorted[lang])
            .filter(module => module.noMapkit)
            .sort((a, b) =>
                a.title < b.title ? -1 : a.title > b.title ? 1 : 0
            )
            .map(m => ({
                title: m.title,
                f: m.f.replace(/(^[a-z]{2}_[A-Z]{2}\/|\..*?$)/g, ''),
            })),
    ];
    (modulesSorted as unknown as {[lang: string]: string[]})[lang] = [
        ...Object.values(modulesSorted[lang])
            .sort((a, b) =>
                a.title < b.title ? -1 : a.title > b.title ? 1 : 0
            )
            .map(file => file.f),
    ];
    if (fs.existsSync(`./docs/${lang}/apps.md`))
        (modulesSorted as unknown as {[lang: string]: string[]})[lang].unshift(`${lang}/apps.md`);
});

const locales = {} as {[langPath: string]: {lang: string, title: string}};
const themeLocales = {} as {[langPath: string]: {label: string, nav: {text: string, link: string}[], sidebar: unknown[]}};

const sidebar_lssm = ['', 'metadata'];
const sidebar_others = [
    'suggestions',
    'support',
    'error_report',
    'faq',
    'bugs',
    'appstore',
    'settings',
    'other',
];

Object.keys(config.games).forEach(lang => {
    if (!fs.existsSync(`./docs/${lang}`)) return;
    const game = config.games[lang];
    const langPath = `/${lang}/`;
    locales[langPath] = {
        lang,
        title: `LSS-Manager V.4 Wiki ${game.flag}`,
    };
    themeLocales[langPath] = {
        label: `${game.flag} ${game.name}`,
        nav: [
            {
                text: 'Discord',
                link: config.discord,
            },
        ],
        sidebar: [
            {
                title: 'LSSM',
                collapsable: false,
                children: sidebar_lssm
                    .filter(f =>
                        fs.existsSync(`./docs${langPath}${f || 'README'}.md`)
                    )
                    .map(f => `${langPath}${f}`),
            },
            ...sidebar_others
                .filter(f =>
                    fs.existsSync(`./docs${langPath}${f || 'README'}.md`)
                )
                .map(f => `${langPath}${f}`),
            {
                title: 'Apps 📦',
                collapsable: true,
                children: modulesSorted[lang] || [],
            },
        ],
    };
});

const options = {
    title: 'LSS-Manager V.4 Wiki',
    description: 'The Wiki for the LSS-Manager',
    base: '/v4/docs/',
    dest: './dist/docs',
    head: [
        [
            'link',
            {
                rel: 'icon',
                href: '/img/lssm.png',
            },
        ],
    ],
    markdown: {
        sluglify: '',
        lineNumbers: true,
    },
    themeConfig: {
        logo: '/img/lssm.png',
        variables: {
            discord: config.discord,
            discord_support: config.discord_support,
            github: config.github.repo,
            server: config.server,
            versions: require('../../static/.configs.json').versions,
            browsers: config.browser,
            noMapkitModules,
        },
        locales: themeLocales,
        activeHeaderLinks: true,
        repo: config.github.repo,
        editLinks: false,
    },
    locales,
    plugins: {
        '@vuepress/active-header-links': {},
        '@vuepress/back-to-top': {},
        '@vuepress/last-updated': {
            transformer(timestamp: number, lang: string) {
                const moment = require('moment');
                moment.locale(lang);
                return moment(timestamp).format('LLL');
            },
        },
        'vuepress-plugin-redirect': {
            locales: true,
        },
        'vuepress-plugin-smooth-scroll': {},
        'vuepress-plugin-zooming': {
            selector: 'img:not([data-prevent-zooming])',
            options: {
                bgColor: 'black',
            },
        },
    },
};

module.exports = options;
