#include "samplereader.h"
#include "utils.h"

#include <iostream>
#include <limits>
#include <stdexcept>
#include <type_traits>
#include <vector>

FileSampleReader::FileSampleReader(FILE *f) : f{f} {}
int FileSampleReader::read(void *arr, int num) {
    // FIX: fread_unlocked may return a short count on USB hiccups (RX-888).
    // Retry until all bytes are received, or throw on EOF/error so the caller
    // never silently processes a half-stale FFT frame.
    size_t total = 0;
    uint8_t *buf = static_cast<uint8_t *>(arr);
    while (total < static_cast<size_t>(num)) {
        size_t n = fread_unlocked(buf + total, sizeof(uint8_t),
                                  num - total, f);
        if (n == 0) {
            if (feof(f))
                throw std::runtime_error("RX-888 stream: EOF reached");
            if (ferror(f))
                throw std::runtime_error("RX-888 stream: read error");
            // Spurious zero-return (shouldn't happen, but be safe)
            break;
        }
        total += n;
    }
    return static_cast<int>(total);
}

SampleConverterBase::SampleConverterBase(std::unique_ptr<SampleReader> reader)
    : reader(std::move(reader)) {}

template <typename T>
SampleConverter<T>::SampleConverter(std::unique_ptr<SampleReader> reader)
    : SampleConverterBase(std::move(reader)) {}

template <typename T> struct type_ {
    using type = T;
};

// No alignment is promised to the compiler here. The buffers come from
// FFT::malloc — fftwf_malloc, plain malloc or a mapped OpenCL buffer — and
// fftwf_malloc aligns only as far as the distribution's FFTW build asks for:
// 32 or 64 bytes with AVX, 16 without SIMD (openSUSE Tumbleweed), 8 on 32-bit
// ARM. The old std::assume_aligned<64> let -march=native emit aligned AVX
// loads (vmovdqa) that fault on such a buffer: spectrumserver died with
// SIGSEGV on its first samples. Unaligned loads cost nothing extra when the
// data happens to be aligned, and this loop is memory-bound anyway.
template <typename T, typename T_signed> void convert(float *arr, T_signed *scratch, float scale, size_t num) {
    //[[assume(num % (64 / sizeof(T)) == 0)]];
    [[assume(num > 0)]];
    for (size_t i = 0; i < num; i++) {
        if constexpr (std::is_unsigned<T>::value) {
            scratch[i] = scratch[i] ^ ((T)1 << (sizeof(T) * 8 - 1));
        }
        arr[i] = ((float)scratch[i]) / scale;
    }
}

template <typename T> void SampleConverter<T>::read(float *arr, int num) {
    // Use the last part of the array as a scratch buffer
    T *scratch;
    if constexpr (sizeof(T) > sizeof(float)) {
        scratch = new T[num];
    } else {
        scratch = ((T *)&arr[num]) - num;
    }
    reader->read(scratch, sizeof(T) * num);
    auto constexpr static unsigned_type = []() {
        if constexpr (std::is_unsigned<T>::value) {
            return type_<typename std::make_signed<T>::type>{};
        } else {
            return type_<T>{};
        }
    };
    typedef typename decltype(unsigned_type())::type T_signed;
    constexpr float scale = []() {
        if constexpr (std::is_integral<T>::value) {
            return (float)std::numeric_limits<T_signed>::max() + 1.;
        } else {
            return 1.;
        }
    }();
    convert<T, T_signed>(arr, (T_signed*)scratch, scale, num);
    if constexpr (sizeof(T) > sizeof(float)) {
        delete[] scratch;
    }
}

template class SampleConverter<uint8_t>;
template class SampleConverter<int8_t>;
template class SampleConverter<uint16_t>;
template class SampleConverter<int16_t>;
template class SampleConverter<uint32_t>;
template class SampleConverter<int32_t>;
template class SampleConverter<uint64_t>;
template class SampleConverter<int64_t>;
template class SampleConverter<float>;
template class SampleConverter<double>;