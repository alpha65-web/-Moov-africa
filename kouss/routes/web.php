<?php

use App\Exports\ClasseExport;
use App\Exports\CoursExport;
use App\Exports\FiliereExport;
use App\Exports\MatiereExport;
use App\Exports\NiveauExport;
use App\Exports\SujetsExport;
use App\Http\Controllers\FileController;
use App\Http\Controllers\PdfController;
use App\Livewire\Admin\Classe\ClasseCreate;
use App\Livewire\Admin\Classe\ClasseForm;
use App\Livewire\Admin\Classe\ClasseList;
use App\Livewire\Admin\Cours\CoursCreate;
use App\Livewire\Admin\Cours\CoursForm;
use App\Livewire\Admin\Cours\CoursList;
use App\Livewire\Admin\Dashboard;
use App\Livewire\Admin\Etudiant\EtudiantCreate;
use App\Livewire\Admin\Etudiant\EtudiantForm;
use App\Livewire\Admin\Etudiant\EtudiantList;
use App\Livewire\Admin\Filiere\FiliereCreate;
use App\Livewire\Admin\Filiere\FiliereForm;
use App\Livewire\Admin\Filiere\FiliereList;
use App\Livewire\Admin\Matiere\MatiereCreate;
use App\Livewire\Admin\Matiere\MatiereForm;
use App\Livewire\Admin\Matiere\MatiereList;
use App\Livewire\Admin\Niveau\NiveauCreate;
use App\Livewire\Admin\Niveau\NiveauForm;
use App\Livewire\Admin\Niveau\NiveauList;
use App\Livewire\Admin\Sujet\SujetCreate;
use App\Livewire\Admin\Sujet\SujetForm;
use App\Livewire\Admin\Sujet\SujetList;
use App\Livewire\Admin\Telechargement\TelechargementList;
use App\Livewire\Etudiant\EditClasse;
use App\Livewire\Etudiant\Filiere;
use App\Livewire\Etudiant\Niveau;
use App\Livewire\Etudiant\Sujet;
use App\Livewire\Etudiant\SujetEtudiant;
use Illuminate\Support\Facades\Route;
use Livewire\Volt\Volt;
use Maatwebsite\Excel\Excel as MaatwebsiteExcel;
use Maatwebsite\Excel\Facades\Excel;

Route::get('/', function () {
    return view('page.home');
})->name('homepage');


Route::middleware(['auth', 'verified', 'role:admin'])->group(function () {

    Route::get('admin/dashboard', Dashboard::class)
        ->name('admin.dashboard');

    Route::get('admin/matiere/list', MatiereList::class)
        ->name('admin.matiere.list');
    Route::get('admin/matiere/create', MatiereCreate::class)
        ->name('admin.matiere.create');
    Route::get('admin/matiere/edit/{id}', MatiereForm::class)
        ->name('admin.matiere.edit');

    Route::get('admin/cours/create', CoursCreate::class)
        ->name('admin.cours.create');
    Route::get('admin/cours/list', CoursList::class)
        ->name('admin.cours.list');
    Route::get('admin/cours/edit/{id}', CoursForm::class)
        ->name('admin.cours.edit');

    Route::get('admin/sujet/create', SujetCreate::class)
        ->name('admin.sujet.create');
    Route::get('admin/sujet/list', SujetList::class)
        ->name('admin.sujet.list');
    Route::get('admin/sujet/edit/{id}', SujetForm::class)
        ->name('admin.sujet.edit');

    Route::get('admin/filiere/create', FiliereCreate::class)
        ->name('admin.filiere.create');
    Route::get('admin/filiere/list', FiliereList::class)
        ->name('admin.filiere.list');
    Route::get('admin/filiere/edit/{id}', FiliereForm::class)
        ->name('admin.filiere.edit');

    Route::get('admin/niveau/create', NiveauCreate::class)
        ->name('admin.niveau.create');
    Route::get('admin/niveau/list', NiveauList::class)
        ->name('admin.niveau.list');
    Route::get('admin/niveau/edit/{id}', NiveauForm::class)
        ->name('admin.niveau.edit');

    Route::get('admin/classe/create', ClasseCreate::class)
        ->name('admin.classe.create');
    Route::get('admin/classe/list', ClasseList::class)
        ->name('admin.classe.list');
    Route::get('admin/classe/edit/{id}', ClasseForm::class)
        ->name('admin.classe.edit');

    // export routes
    Route::get('export/sujets', function () {
        return Excel::download(new SujetsExport, 'liste_sujets.xlsx', MaatwebsiteExcel::XLSX);
    })->name('sujets.export');
    Route::get('export/cours', function () {
        return Excel::download(new CoursExport, 'liste_cours.xlsx', MaatwebsiteExcel::XLSX);
    })->name('cours.export');
    Route::get('export/matiere', function () {
        return Excel::download(new MatiereExport, 'liste_matieres.xlsx', MaatwebsiteExcel::XLSX);
    })->name('matiere.export');
    Route::get('export/filiere', function () {
        return Excel::download(new FiliereExport, 'liste_filiere.xlsx', MaatwebsiteExcel::XLSX);
    })->name('filiere.export');
    Route::get('export/niveau', function () {
        return Excel::download(new NiveauExport, 'liste_niveau.xlsx', MaatwebsiteExcel::XLSX);
    })->name('niveau.export');
    Route::get('export/classe', function () {
        return Excel::download(new ClasseExport, 'liste_classe.xlsx', MaatwebsiteExcel::XLSX);
    })->name('classe.export');

});

Route::middleware(['auth'])->group(function () {
    Route::redirect('settings', 'settings/profile');

    Volt::route('settings/profile', 'settings.profile')->name('settings.profile');
    Volt::route('settings/password', 'settings.password')->name('settings.password');
    Volt::route('settings/appearance', 'settings.appearance')->name('settings.appearance');
});

Route::get('etudiant/filiere', Filiere::class)
    ->name('etudiant.filiere');
Route::get('etudiant/{id}/niveau', Niveau::class)
    ->name('etudiant.niveau');
Route::get('etudiant/sujet/{id}', Sujet::class)
    ->name('etudiant.sujet');
Route::get('etudiant/sujet/{id}/download', [FileController::class, 'download'])
    ->name('etudiant.sujet.download');

// routes/web.php
Route::get('/view-pdf/{sujets:nom_sujet}', [PdfController::class, 'viewPdf'])
    ->name('view.pdf');
Route::get('/show-pdf')->name('show.pdf');

require __DIR__ . '/auth.php';
