/*
 * Copyright (c) 2015, Peter Thorson. All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *     * Redistributions of source code must retain the above copyright
 *       notice, this list of conditions and the following disclaimer.
 *     * Redistributions in binary form must reproduce the above copyright
 *       notice, this list of conditions and the following disclaimer in the
 *       documentation and/or other materials provided with the distribution.
 *     * Neither the name of the WebSocket++ Project nor the
 *       names of its contributors may be used to endorse or promote products
 *       derived from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
 * ARE DISCLAIMED. IN NO EVENT SHALL PETER THORSON BE LIABLE FOR ANY
 * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *
 */

#ifndef WEBSOCKETPP_COMMON_ASIO_HPP
#define WEBSOCKETPP_COMMON_ASIO_HPP

// This file goes to some length to preserve compatibility with versions of 
// boost older than 1.49 (where the first modern steady_timer timer based on 
// boost/std chrono was introduced.
//
// For the versions older than 1.49, the deadline_timer is used instead. this
// brings in dependencies on boost date_time and it has a different interface
// that is normalized by the `lib::asio::is_neg` and `lib::asio::milliseconds`
// wrappers provided by this file.
//
// The primary reason for this continued support is that boost 1.48 is the
// default and not easily changeable version of boost supplied by the package
// manager of popular Linux distributions like Ubuntu 12.04 LTS. Once the need
// for this has passed this should be cleaned up and simplified.

#ifdef ASIO_STANDALONE
    #include <asio/version.hpp>
    
    #if (ASIO_VERSION/100000) == 1 && ((ASIO_VERSION/100)%1000) < 8
        static_assert(false, "The minimum version of standalone Asio is 1.8.0");
    #endif
    
    #include <asio.hpp>
    #include <asio/steady_timer.hpp>
    #include <websocketpp/common/chrono.hpp> 
#else
    #include <boost/version.hpp>
    
    // See note above about boost <1.49 compatibility. If we are running on 
    // boost > 1.48 pull in the steady timer and chrono library
    #if (BOOST_VERSION/100000) == 1 && ((BOOST_VERSION/100)%1000) > 48
        #include <boost/asio/steady_timer.hpp>
        #include <websocketpp/common/chrono.hpp>
    #endif
    
    #include <boost/asio.hpp>
    #include <boost/system/error_code.hpp>
#endif

// --- PhantomSDR-Plus patch ---------------------------------------------------
// Asio 1.12 (Boost 1.66) replaced socket_base::max_connections with
// max_listen_connections, and resolver::query / resolver::iterator with the
// host+service overloads and results_type. Boost 1.87 removed the old forms
// altogether. This macro selects the modern spelling where it is available.
#if (defined(BOOST_VERSION) && BOOST_VERSION >= 106600) || \
    (defined(ASIO_VERSION) && ASIO_VERSION >= 101200)
    #define _WEBSOCKETPP_ASIO_MODERN_API_
#endif
// --- end patch ---------------------------------------------------------------

namespace websocketpp {
namespace lib {

#ifdef ASIO_STANDALONE
    namespace asio {
        using namespace ::asio;

        // --- PhantomSDR-Plus patch: max_connections removed in Boost 1.87 ---
        #ifdef _WEBSOCKETPP_ASIO_MODERN_API_
            static const int ws_max_listen_backlog =
                ::asio::socket_base::max_listen_connections;
        #else
            static const int ws_max_listen_backlog =
                ::asio::socket_base::max_connections;
        #endif
        // --- end patch ------------------------------------------------------

        // Here we assume that we will be using std::error_code with standalone
        // Asio. This is probably a good assumption, but it is possible in rare
        // cases that local Asio versions would be used.
        using std::errc;
        
        // See note above about boost <1.49 compatibility. Because we require
        // a standalone Asio version of 1.8+ we are guaranteed to have 
        // steady_timer available. By convention we require the chrono library
        // (either boost or std) for use with standalone Asio.
        template <typename T>
        bool is_neg(T duration) {
            return duration.count() < 0;
        }
        inline lib::chrono::milliseconds milliseconds(long duration) {
            return lib::chrono::milliseconds(duration);
        }

        // --- PhantomSDR-Plus patch: see the boost branch below --------------
        template <typename T>
        bool has_expired(T & timer) {
            #if defined(ASIO_VERSION) && ASIO_VERSION >= 101200
                return is_neg(timer.expiry() - T::clock_type::now());
            #else
                return is_neg(timer.expires_from_now());
            #endif
        }
        // --- end patch ------------------------------------------------------
    } // namespace asio
    
#else
    namespace asio {
        using namespace boost::asio;

        // --- PhantomSDR-Plus patch: max_connections removed in Boost 1.87 ---
        #ifdef _WEBSOCKETPP_ASIO_MODERN_API_
            static const int ws_max_listen_backlog =
                boost::asio::socket_base::max_listen_connections;
        #else
            static const int ws_max_listen_backlog =
                boost::asio::socket_base::max_connections;
        #endif
        // --- end patch ------------------------------------------------------


        // --- PhantomSDR-Plus patch: Boost 1.87+ compatibility ---------------
        // Boost 1.87 deleted the long-deprecated io_service alias, the nested
        // io_service::work class, io_service::reset() and io_service::post().
        // websocketpp 0.8.2 predates all four. The shims below express the
        // same operations through the modern io_context API, and fall back to
        // the classic spelling on older Boost, so one set of headers builds
        // everywhere from Ubuntu 22.04 (1.74) to Arch (1.91).
        #if BOOST_VERSION >= 108700
            typedef boost::asio::io_context io_service;

            /// Keeps an io_context running while it has no outstanding work
            typedef boost::asio::executor_work_guard<
                boost::asio::io_context::executor_type> ws_work;

            inline ws_work * make_ws_work(io_service & service) {
                return new ws_work(boost::asio::make_work_guard(service));
            }

            inline void ws_restart(io_service & service) {
                service.restart();
            }

            template <typename Handler>
            void ws_post(io_service & service, Handler handler) {
                boost::asio::post(service, handler);
            }
        #else
            typedef boost::asio::io_service::work ws_work;

            inline ws_work * make_ws_work(boost::asio::io_service & service) {
                return new ws_work(service);
            }

            inline void ws_restart(boost::asio::io_service & service) {
                service.reset();
            }

            template <typename Handler>
            void ws_post(boost::asio::io_service & service, Handler handler) {
                service.post(handler);
            }
        #endif
        // --- end patch ------------------------------------------------------

        // See note above about boost <1.49 compatibility
        #if (BOOST_VERSION/100000) == 1 && ((BOOST_VERSION/100)%1000) > 48
            // Using boost::asio >=1.49 so we use chrono and steady_timer
            template <typename T>
            bool is_neg(T duration) {
                return duration.count() < 0;
            }

            // --- PhantomSDR-Plus patch -------------------------------------
            // Boost 1.89 removed basic_waitable_timer::expires_from_now(),
            // deprecated since 1.66. Ubuntu 26.04 ships Boost 1.90, where
            // websocketpp 0.8.2 no longer compiles. has_expired() asks the
            // same question ("is this timer already past due?") through the
            // modern API, and keeps the old one for older Boost. T::clock_type
            // is used so this is correct whether asio was built against
            // std::chrono or boost::chrono.
            template <typename T>
            bool has_expired(T & timer) {
                #if BOOST_VERSION >= 108900
                    return is_neg(timer.expiry() - T::clock_type::now());
                #else
                    return is_neg(timer.expires_from_now());
                #endif
            }
            // --- end patch --------------------------------------------------

            // If boost believes it has std::chrono available it will use it
            // so we should also use it for things that relate to boost, even
            // if the library would otherwise use boost::chrono.
            #if defined(BOOST_ASIO_HAS_STD_CHRONO)
                inline std::chrono::milliseconds milliseconds(long duration) {
                    return std::chrono::milliseconds(duration);
                }
            #else
                inline lib::chrono::milliseconds milliseconds(long duration) {
                    return lib::chrono::milliseconds(duration);
                }
            #endif
        #else
            // Using boost::asio <1.49 we pretend a deadline timer is a steady
            // timer and wrap the negative detection and duration conversion
            // appropriately.
            typedef boost::asio::deadline_timer steady_timer;
            
            template <typename T>
            bool is_neg(T duration) {
                return duration.is_negative();
            }
            inline boost::posix_time::time_duration milliseconds(long duration) {
                return boost::posix_time::milliseconds(duration);
            }
        #endif
        
        using boost::system::error_code;
        namespace errc = boost::system::errc;
    } // namespace asio
#endif


} // namespace lib
} // namespace websocketpp

#endif // WEBSOCKETPP_COMMON_ASIO_HPP
