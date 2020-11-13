"use strict";

// требуем плагины
let projectFolder = "build";
let sourceFolder = "source";

let plumber = require("gulp-plumber");
let { src, dest } = require("gulp");
let gulp = require("gulp");
let browserSync = require("browser-sync").create();
let fileInclude = require("gulp-file-include");
let fileDel = require("del");
let scssPre = require("gulp-sass");
let autoPrefixer = require("gulp-autoprefixer");
let mediaQueryOprimize = require("gulp-group-css-media-queries");
let cssClean = require("gulp-clean-css");
let fileRename = require("gulp-rename");
let jsOpti = require("gulp-uglify-es").default;
let imgOpti = require("gulp-imagemin");
let webpConvert = require("gulp-webp");
let webpInsert = require("gulp-webp-in-html");
let retinaInsert = require("gulp-img-retina");
let retinaPrefixDefault = {
  suffix: { 1: "", 2: "@2x" }, // префиксы, к-ые будут прописаны ретиной в html
};
let svgSpriteMake = require("gulp-svg-sprite");
let ttf2woff = require("gulp-ttf2woff");
let ttf2woff2 = require("gulp-ttf2woff2");
let codeMap = require("gulp-sourcemaps");

let ghPages = require("gulp-gh-pages");

// создаем объект описывающий данные для скрипта
let path = {
  build: {
    html: projectFolder + "/",
    css: projectFolder + "/css/",
    js: projectFolder + "/js/",
    img: projectFolder + "/img/",
    fonts: projectFolder + "/fonts/",
  },
  source: {
    html: [sourceFolder + "/*.html", "!" + sourceFolder + "/_*.html"], // прописываем исключение ненужных html (все они помечены _name.html)
    scss: sourceFolder + "/sass/style.scss",
    js: sourceFolder + "/js/script.js",
    img: [
      sourceFolder + "/img/**/*.{jpg,png,svg,gif,ico,webp}",
      "!" + sourceFolder + "/img/**/_*.svg",
    ],
    fonts: sourceFolder + "/fonts/*.ttf",
  },
  watch: {
    html: sourceFolder + "/**/*.html",
    scss: sourceFolder + "/sass/**/*.scss",
    js: sourceFolder + "/js/**/*.js",
    img: sourceFolder + "/img/**/*.{jpg,png,svg,gif,ico,webp}",
  },
  destroy: "./" + projectFolder + "/",
};

// вывод в браузер
function browserSyncGo(params) {
  browserSync.init({
    server: {
      baseDir: "./" + projectFolder + "/",
    },
    port: 1911,
    notify: false,
  });
}

// функция обработки html
function htmlGo() {
  return src(path.source.html)
    .pipe(retinaInsert(retinaPrefixDefault))
    .pipe(webpInsert()) // добавляет в html код для webp-версий изображений
    .pipe(fileInclude()) // добавляет html файлы в другой html через @@include('имя файла')

    .pipe(dest(path.build.html))
    .pipe(browserSync.stream());
}

// функция обработки css
// вход style через include, остальные блоки отдельные файлы
function cssGo() {
  return src(path.source.scss)
    .pipe(plumber())
    .pipe(codeMap.init())
    .pipe(
      scssPre({
        outputStyle: "expanded",
      })
    )
    .pipe(mediaQueryOprimize())
    .pipe(
      autoPrefixer({
        overrideBrowserslist: ["last 5 versions"],
        cascade: true,
      })
    )
    .pipe(dest(path.build.css)) // выгрузка до оптимизации
    .pipe(cssClean())
    .pipe(
      fileRename({
        extname: ".min.css",
      })
    )
    .pipe(codeMap.write("."))
    .pipe(dest(path.build.css)) // после оптимизации, подключ. в финальный index
    .pipe(browserSync.stream());
}

// обработка JS
function jsGo() {
  return src(path.source.js)
    .pipe(fileInclude())
    .pipe(dest(path.build.js)) // выгрузка до оптимизации
    .pipe(jsOpti())
    .pipe(
      fileRename({
        extname: ".min.js",
      })
    )
    .pipe(dest(path.build.js)) // после оптимизации, подключ. в финальный index
    .pipe(browserSync.stream());
}

// функция обработки изображений: конвертация в Webp и оптимизация размера
function imgGo() {
  return src(path.source.img)
    .pipe(
      webpConvert({
        quality: 70,
      })
    )
    .pipe(dest(path.build.img))
    .pipe(src(path.source.img))
    .pipe(
      imgOpti({
        progressive: true,
        svgoPlugins: [{ removeViewBox: false }],
        interlaced: true,
        optimizationLevel: 0, // от 0 до 7
      })
    )
    .pipe(dest(path.build.img))
    .pipe(browserSync.stream());
}

function spriteMake() {
  return src([sourceFolder + "/img/iconsprite/_*.svg"])
    .pipe(
      imgOpti({
        svgoPlugins: [{ removeViewBox: false }],
        optimizationLevel: 3, // от 0 до 7
      })
    )
    .pipe(
      svgSpriteMake({
        mode: {
          stack: {
            sprite: "../iconsprite/icons.svg",
            example: true,
          },
        },
      })
    )
    .pipe(dest(path.build.img));
}

// следим за изменения в файлах
function watchFiles(params) {
  gulp.watch([path.watch.html], htmlGo); // передаем путь из объекта и фукнцию которую надо применить при изменении файла
  gulp.watch([path.watch.scss], cssGo);
  gulp.watch([path.watch.js], jsGo);
  gulp.watch([path.watch.img], imgGo);
  gulp.watch([path.watch.img], spriteMake);
}

// удаляем все из папки билд
function destroyBuild(params) {
  return fileDel(path.destroy);
}

gulp.task("fontsConverter", function () {
  src(path.src.fonts).pipe(ttf2woff()).pipe(dest(path.build.fonts));

  return pipe(src(path.src.fonts))
    .pipe(ttf2woff2())
    .pipe(dest(path.build.fonts));
});

gulp.task("deploy", function () {
  return gulp.src("./build/**/*").pipe(ghPages());
});

function publishGitPage() {
  return gulp.src("./build/**/*").pipe(ghPages());
}

// оформляем серии для gulp
let build = gulp.series(
  destroyBuild,
  gulp.parallel(jsGo, htmlGo, cssGo, imgGo, spriteMake)
);
let watch = gulp.parallel(build, watchFiles, browserSyncGo);

// Соберет весь проект и обупдикует в gh-pages (ветка должна быть предварительно создана)
let publish = gulp.series(build, publishGitPage);

// оформляем экспорты
exports.publish = publish;
exports.gitpage = publishGitPage;
exports.sprite = spriteMake;
exports.img = imgGo;
exports.js = jsGo;
exports.css = cssGo;
exports.html = htmlGo;
exports.build = build;
exports.watch = watch;
exports.default = watch;
