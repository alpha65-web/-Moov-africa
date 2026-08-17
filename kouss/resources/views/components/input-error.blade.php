@props(["name" => null])

@error($name)
<div class="w-full flex">
    <p class="text-xs block text-primary">
        {{ $message }}
    </p>
</div>
@enderror
