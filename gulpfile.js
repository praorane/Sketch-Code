/// <binding ProjectOpened='default' />
var gulp    = require('gulp'),
    sass    = require('gulp-sass');

var PATH = {
    SCSS: [
        'Content/**/**.scss'
    ]
}

gulp.task('sass', function () {
    gulp.src('Content/site.scss', { base: './' })
        .pipe(sass({ outputStyle: 'expanded' }))
        .pipe(gulp.dest('./'));
});

gulp.task('default', ['sass'], function () {
    gulp.watch(PATH.SCSS, ['sass']);
});