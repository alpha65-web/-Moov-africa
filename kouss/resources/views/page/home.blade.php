<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="ie=edge">
    <title>Document</title>
    @include('partials.head')
</head>

<body class="effect w-full h-dvh">
    <nav class="flex items-center justify-center w-full px-4 bg-white shadow-sm sm:px-6 h-fit">
        <div class="flex items-center justify-between w-full py-2 max-w-7xl">
            <a href="{{ route('homepage') }}"> <img src="{{ asset('img/ESTA.png') }}" alt="" class="h-6">
            </a>
            <a href="{{ route('etudiant.filiere') }}">
                <x-button-icon center="true" style="primary-icon px-3" text="Pourcourir les sujets" />
            </a>
        </div>

    </nav>

    <div class="flex items-center flex-col relative w-full h-dvh p-4 overflow-hidden">
        <div class="flex flex-col gap-6 items-center mt-16 w-full py-2 max-w-3xl">
            <div class="flex flex-col gap-2 items-center w-full">
                <span
                    class="text-sm py-1 px-3 rounded-full font-semibold bg-neutral-100 flex items-center gap-1 border border-orange-900/20 text-orange-900">
                    <x-lucide-zap class="w-4 h-4" />
                    Par le bureau des étudiants
                </span>
                <h1
                    class="text-secondary tracking-tight leading-tighter text-center font-bold text-balance text-3xl md:text-4xl lg:text-5xl">
                    Tous vos sujets de devoir... tous là, en un seul endroit.</h1>
                <h4
                    class="text-neutral-500 font-semibold text-base text-pretty tracking-tight w-full max-w-lg text-center leading-relaxed">
                    Accédez, téléchargez, visionnez et filtrez vos différents sujets de devoir, quelque soit la filiere,
                    la classes ou la matière, grace à
                    la plateforme des étudiants de l'ESTA.</h4>
            </div>
            <div class="relative p-3 border border-black/10 bg-neutral-100">
                <a href="{{ route('etudiant.filiere') }}">
                    <x-button-icon center="true" style="primary-icon px-6 rounded-full"
                        text="Découvrir la plateforme" />
                </a>
                <div class="absolute top-1 left-1 size-1 rounded-full bg-secondary/20"></div>
                <div class="absolute top-1 right-1 size-1 rounded-full bg-secondary/20"></div>
                <div class="absolute bottom-1 left-1 size-1 rounded-full bg-secondary/20"></div>
                <div class="absolute bottom-1 right-1 size-1 rounded-full bg-secondary/20"></div>
            </div>
        </div>

        <div class="absolute hidden md:block bottom-0 left-0 h-1/2 w-full">
            <img src="{{ asset('img/bureau_des_etudiants.png') }}"
                class="object-cover object-bottom w-full max-w-5xl filter drop-shadow-2xl h-auto mx-auto"
                alt="bureau_des_etudiants">
        </div>
        <div class="flex mt-5 md:hidden">
            <img src="{{ asset('img/bureau_des_etudiants.png') }}"
                class="object-cover object-bottom w-full max-w-5xl filter drop-shadow-2xl h-auto mx-auto"
                alt="bureau_des_etudiants">
        </div>
    </div>

</body>

</html>
