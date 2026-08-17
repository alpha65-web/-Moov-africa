<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}" class="dark">

<head>
    @include('partials.head')
</head>

<body>

    <div class="flex justify-center w-full min-h-screen">

        <div class="flex w-full h-full">

            <div
                class="sticky top-0 items-center hidden w-full overflow-hidden bg-white border-r h-dvh lg:w-1/2 lg:flex border-r-border">
                <img src="{{ asset('img/img2.png') }}" class="object-cover w-full h-full" alt="">
            </div>

            <div
                class="relative flex flex-col justify-start w-full gap-8 px-4 py-8 items-center-safe effect bg-neutral-50 lg:justify-center-safe min-h-dvh lg:w-1/2">
                <div class="fixed z-50 flex items-center rounded-full shadow-lg lg:absolute top-4 left-4">
                    <a href="{{ route('homepage') }}"
                        class="flex items-center gap-1 px-2 py-1 border rounded-full active-scale border-neutral-300 bg-neutral-50">
                        <span class="flex items-center gap-1">
                            <x-lucide-arrow-left class="size-4 text-neutral-900" />
                            <p class="text-sm text-neutral-900">Accueil</p>
                        </span>
                    </a>
                </div>

                <div class="flex flex-col items-center w-full">
                    <div class="w-full max-w-[400px] h-auto relative top-8 rounded-md overflow-hidden lg:hidden ">
                        <img src="{{ asset('img/img2.png') }}"
                            class="object-cover object-top w-full h-auto relative mask-b-from-50% mask-b-to-90%  z-20"
                            alt="">
                        <div class="absolute inset-0 bg-white mask-b-from-90% mask-b-to-100%"></div>
                        <div class="absolute z-50 rounded-full top-2 left-2 size-1 bg-neutral-500"></div>
                        <div class="absolute z-50 rounded-full top-2 right-2 size-1 bg-neutral-500"></div>
                    </div>

                    <a href="{{ route('homepage') }}" class="z-20 flex items-center gap-2 font-medium lg:mt-0">
                        <span class="flex items-center justify-center rounded-md h-9">
                            <x-app-logo-icon class="object-contain text-black h-9 dark:text-white" />
                        </span>

                        <span class="sr-only">{{ config('app.name', 'ESTA') }}</span>
                    </a>
                </div>
                {{ $slot }}
            </div>

        </div>

    </div>

    <script>
        const togglePassword = document.querySelectorAll('.password-toggle');

        togglePassword.forEach(element => {
            const eyeIcon = element.querySelector('.lucide-eye-icon');
            const eyeOffIcon = element.querySelector('.lucide-eye-off-icon');
            const input = element.querySelector('.password');
            const toggleButton = element.querySelector('.toggle-button');
            if (input) {
                toggleButton.addEventListener("click", function() {
                    const type = input.getAttribute('type') === 'password' ? 'text' : 'password';
                    input.setAttribute('type', type);
                    eyeIcon.classList.toggle('hidden');
                    eyeOffIcon.classList.toggle('hidden');
                })
            }
        });
    </script>

    @fluxScripts
</body>

</html>
